import { symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_AGENT_TERM_CODE_UNITS, MAX_AGENT_TERMS } from '../agentTermCaps'
import { collectAgentTerms } from '../agentSearchTerms'
import type { SubagentEntry } from '../../transcript/discoverSubagents'
import { resolveSubagentMeta } from '../resolveSubagentMeta'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

let dir: SessionScanDir | undefined

afterEach(() => {
  dir?.cleanup()
  dir = undefined
})

/** Writes subagents with the given metas, in order, and returns their entries. */
function subagentsWith(
  metas: readonly (string | Record<string, unknown> | undefined)[]
): SubagentEntry[] {
  dir = createSessionScanDir()
  const scanDir = dir
  return metas.map((meta, index) =>
    scanDir.addSubagent(`a${String(index).padStart(4, '0')}`, { transcript: '', meta })
  )
}

describe('collectAgentTerms', () => {
  it('collects a subagent’s name, description and type', async () => {
    const subagents = subagentsWith([
      { agentType: 'Explore', description: 'Map the auth flow', name: 'scout' }
    ])

    expect(await collectAgentTerms(subagents)).toEqual({
      terms: [{ name: 'scout', description: 'Map the auth flow', agentType: 'Explore' }],
      truncated: false,
      complete: true
    })
  })

  it('reads a field the meta lacks as null', async () => {
    const subagents = subagentsWith([{ agentType: 'general-purpose' }])

    expect((await collectAgentTerms(subagents)).terms).toEqual([
      { name: null, description: null, agentType: 'general-purpose' }
    ])
  })

  it('has no terms for a session without subagents', async () => {
    expect(await collectAgentTerms([])).toEqual({ terms: [], truncated: false, complete: true })
  })

  it('adds nothing for a subagent with no meta file, and still counts as complete', async () => {
    const subagents = subagentsWith([undefined, { agentType: 'Explore' }])

    expect(await collectAgentTerms(subagents)).toMatchObject({
      terms: [{ agentType: 'Explore' }],
      complete: true
    })
  })

  it.each([
    ['invalid JSON', 'not json'],
    ['a shape without agentType', { description: 'no type' }]
  ])('adds nothing for a meta with %s, and reports incomplete', async (_name, meta) => {
    const subagents = subagentsWith([meta, { agentType: 'Explore' }])

    expect(await collectAgentTerms(subagents)).toMatchObject({
      terms: [{ agentType: 'Explore' }],
      truncated: false,
      complete: false
    })
  })

  it('adds nothing for a meta file that is gone, and reports incomplete', async () => {
    dir = createSessionScanDir()
    const missing = dir.missingSubagent('gone')
    const withMeta = { ...missing, metaPath: `${missing.metaPath ?? missing.transcript.path}.x` }

    expect(await collectAgentTerms([withMeta])).toMatchObject({ terms: [], complete: false })
  })

  it('adds nothing for a meta that is a symlink, and reports incomplete', async () => {
    const [entry] = subagentsWith([{ agentType: 'Explore' }])
    const metaPath = entry?.metaPath ?? ''
    const real = join(metaPath, '..', 'real.json')
    writeFileSync(real, JSON.stringify({ agentType: 'Hidden' }), 'utf-8')
    symlinkSync(real, join(metaPath, '..', 'agent-link.meta.json'))
    const linked = {
      ...(entry as NonNullable<typeof entry>),
      metaPath: join(metaPath, '..', 'agent-link.meta.json')
    }

    expect(await collectAgentTerms([linked])).toMatchObject({ terms: [], complete: false })
  })

  it('adds nothing for a meta over the size cap, and reports incomplete', async () => {
    const subagents = subagentsWith([
      JSON.stringify({ agentType: 'Explore', description: 'x'.repeat(70 * 1024) })
    ])

    expect(await collectAgentTerms(subagents)).toMatchObject({ terms: [], complete: false })
  })

  it('keeps one term for subagents that match on name, description and type', async () => {
    const same = { agentType: 'Explore', description: 'Scan', name: 'scout' }
    const subagents = subagentsWith([same, same, { ...same, name: 'other' }])

    expect((await collectAgentTerms(subagents)).terms.map((term) => term.name)).toEqual([
      'scout',
      'other'
    ])
  })

  it('does not report truncation for duplicates beyond the term cap', async () => {
    const subagents = subagentsWith(
      Array.from({ length: MAX_AGENT_TERMS + 10 }, () => ({ agentType: 'Explore' }))
    )

    expect(await collectAgentTerms(subagents)).toMatchObject({
      terms: [{ agentType: 'Explore' }],
      truncated: false
    })
  })

  it('stops at the term cap and reports truncation, reading no further', async () => {
    const subagents = subagentsWith(
      Array.from({ length: MAX_AGENT_TERMS + 5 }, (_unused, index) => ({ agentType: `t${index}` }))
    )
    const readMeta = vi.fn(resolveSubagentMeta)

    const collected = await collectAgentTerms(subagents, readMeta)

    expect(collected.terms).toHaveLength(MAX_AGENT_TERMS)
    expect(collected.truncated).toBe(true)
    expect(readMeta).toHaveBeenCalledTimes(MAX_AGENT_TERMS + 1)
  })

  it('stops at the code unit budget and reports truncation', async () => {
    const description = 'd'.repeat(250)
    const count = Math.ceil(MAX_AGENT_TERM_CODE_UNITS / (description.length + 1)) + 2
    const subagents = subagentsWith(
      Array.from({ length: count }, (_unused, index) => ({
        agentType: String(index % 10),
        description: `${description}${index}`
      }))
    )

    const collected = await collectAgentTerms(subagents)

    expect(collected.truncated).toBe(true)
    const used = collected.terms.reduce(
      (sum, term) => sum + (term.description?.length ?? 0) + (term.agentType?.length ?? 0),
      0
    )
    expect(used).toBeLessThanOrEqual(MAX_AGENT_TERM_CODE_UNITS)
    expect(collected.terms.length).toBeLessThan(count)
  })

  it('keeps every term when the code unit budget is exactly met', async () => {
    const full = (index: number): Record<string, unknown> => ({
      agentType: 't'.repeat(256),
      description: 'd'.repeat(256),
      name: `${'n'.repeat(255)}${index}`
    })
    const subagents = subagentsWith([
      ...Array.from({ length: 5 }, (_unused, index) => full(index)),
      { name: 'q'.repeat(255), agentType: 'z' }
    ])

    const collected = await collectAgentTerms(subagents)

    expect(collected.terms).toHaveLength(6)
    expect(collected.truncated).toBe(false)
  })

  it('keeps every term when the code unit budget is exactly met', async () => {
    const full = (index: number): Record<string, unknown> => ({
      agentType: 't'.repeat(256),
      description: 'd'.repeat(256),
      name: `${'n'.repeat(255)}${index}`
    })
    const subagents = subagentsWith([
      ...Array.from({ length: 5 }, (_unused, index) => full(index)),
      { name: 'q'.repeat(255), agentType: 'z' }
    ])

    const collected = await collectAgentTerms(subagents)

    expect(collected.terms).toHaveLength(6)
    expect(collected.truncated).toBe(false)
  })

  it('keeps every term that fits when a cap is exactly met', async () => {
    const subagents = subagentsWith(
      Array.from({ length: MAX_AGENT_TERMS }, (_unused, index) => ({ agentType: `t${index}` }))
    )

    expect(await collectAgentTerms(subagents)).toMatchObject({ truncated: false })
  })
})
