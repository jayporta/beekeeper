import { symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_AGENT_TERM_CODE_UNITS, MAX_AGENT_TERMS } from '../agentTermCaps'
import { collectAgentTerms, lengthOf } from '../agentSearchTerms'
import type { SubagentEntry } from '../../transcript/discoverSubagents'
import { resolveSubagentMeta } from '../resolveSubagentMeta'
import type { SubagentMetaStatus } from '../subagentMetaStatus'
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
    expect(await collectAgentTerms([])).toEqual({ terms: [], complete: true })
  })

  it('adds nothing for a subagent with no meta file, and still counts as complete', async () => {
    const subagents = subagentsWith([undefined, { agentType: 'Explore' }])

    expect(await collectAgentTerms(subagents)).toMatchObject({
      terms: [{ agentType: 'Explore' }],
      complete: true
    })
  })

  it('adds nothing for invalid JSON, and reports incomplete since it may be mid-write', async () => {
    const subagents = subagentsWith(['not json', { agentType: 'Explore' }])

    expect(await collectAgentTerms(subagents)).toMatchObject({
      terms: [{ agentType: 'Explore' }],
      complete: false
    })
  })

  it('adds nothing for a shape without agentType, and still reports complete', async () => {
    const subagents = subagentsWith([{ description: 'no type' }, { agentType: 'Explore' }])

    expect(await collectAgentTerms(subagents)).toMatchObject({
      terms: [{ agentType: 'Explore' }],
      complete: true
    })
  })

  it('adds nothing for a meta file that is gone, and reports incomplete', async () => {
    dir = createSessionScanDir()
    const missing = dir.missingSubagent('gone')
    const withMeta = { ...missing, metaPath: `${missing.metaPath ?? missing.transcript.path}.x` }

    expect(await collectAgentTerms([withMeta])).toMatchObject({ terms: [], complete: false })
  })

  it('adds nothing for a meta that cannot be read, and reports incomplete', async () => {
    const subagents = subagentsWith([{ agentType: 'Explore' }])
    const unreadable = (): Promise<SubagentMetaStatus> =>
      Promise.resolve({ status: 'error', reason: 'unreadable' })

    expect(await collectAgentTerms(subagents, unreadable)).toMatchObject({
      terms: [],
      complete: false
    })
  })

  it('adds nothing for a meta that is a symlink, and still reports complete', async () => {
    const [entry] = subagentsWith([{ agentType: 'Explore' }])
    const metaPath = entry?.metaPath ?? ''
    const real = join(metaPath, '..', 'real.json')
    writeFileSync(real, JSON.stringify({ agentType: 'Hidden' }), 'utf-8')
    symlinkSync(real, join(metaPath, '..', 'agent-link.meta.json'))
    const linked = {
      ...(entry as NonNullable<typeof entry>),
      metaPath: join(metaPath, '..', 'agent-link.meta.json')
    }

    expect(await collectAgentTerms([linked])).toMatchObject({ terms: [], complete: true })
  })

  it('adds nothing for a meta over the size cap, and still reports complete', async () => {
    const subagents = subagentsWith([
      JSON.stringify({ agentType: 'Explore', description: 'x'.repeat(70 * 1024) })
    ])

    expect(await collectAgentTerms(subagents)).toMatchObject({ terms: [], complete: true })
  })

  it('reports complete for a meta that is not a regular file', async () => {
    const subagents = subagentsWith([{ agentType: 'Explore' }])
    const notAFile = (): Promise<SubagentMetaStatus> =>
      Promise.resolve({ status: 'error', reason: 'not-a-file' })

    expect(await collectAgentTerms(subagents, notAFile)).toMatchObject({ complete: true })
  })

  it('keeps one term for subagents that match on name, description and type', async () => {
    const same = { agentType: 'Explore', description: 'Scan', name: 'scout' }
    const subagents = subagentsWith([same, same, { ...same, name: 'other' }])

    expect((await collectAgentTerms(subagents)).terms.map((term) => term.name)).toEqual([
      'scout',
      'other'
    ])
  })

  it('keeps one term for duplicates beyond the term cap', async () => {
    const subagents = subagentsWith(
      Array.from({ length: MAX_AGENT_TERMS + 10 }, () => ({ agentType: 'Explore' }))
    )

    expect((await collectAgentTerms(subagents)).terms).toEqual([
      { name: null, description: null, agentType: 'Explore' }
    ])
  })

  it('stops at the term cap, reading no further', async () => {
    const subagents = subagentsWith(
      Array.from({ length: MAX_AGENT_TERMS + 5 }, (_unused, index) => ({ agentType: `t${index}` }))
    )
    const readMeta = vi.fn(resolveSubagentMeta)

    const collected = await collectAgentTerms(subagents, readMeta)

    expect(collected.terms).toHaveLength(MAX_AGENT_TERMS)
    expect(readMeta).toHaveBeenCalledTimes(MAX_AGENT_TERMS + 1)
  })

  it('stops at the code unit budget', async () => {
    const description = 'd'.repeat(250)
    const count = Math.ceil(MAX_AGENT_TERM_CODE_UNITS / (description.length + 1)) + 2
    const subagents = subagentsWith(
      Array.from({ length: count }, (_unused, index) => ({
        agentType: String(index % 10),
        description: `${description}${index}`
      }))
    )

    const collected = await collectAgentTerms(subagents)

    const used = collected.terms.reduce((sum, term) => sum + lengthOf(term), 0)
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
  })

  it('truncates when the last term is one code unit over the budget', async () => {
    const full = (index: number): Record<string, unknown> => ({
      agentType: 't'.repeat(256),
      description: 'd'.repeat(256),
      name: `${'n'.repeat(255)}${index}`
    })
    const subagents = subagentsWith([
      ...Array.from({ length: 5 }, (_unused, index) => full(index)),
      { name: 'q'.repeat(256), agentType: 'z' }
    ])

    const collected = await collectAgentTerms(subagents)

    expect(collected.terms).toHaveLength(5)
  })

  it('keeps every term that fits when a cap is exactly met', async () => {
    const subagents = subagentsWith(
      Array.from({ length: MAX_AGENT_TERMS }, (_unused, index) => ({ agentType: `t${index}` }))
    )

    expect((await collectAgentTerms(subagents)).terms).toHaveLength(MAX_AGENT_TERMS)
  })
})
