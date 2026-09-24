import { describe, expect, it } from 'vitest'
import { toAgentId, type AgentId } from '../../transcript/ids'
import type { AgentTreeInput } from '../agentTree'
import { resolveSpawnContexts } from '../resolveSpawnContexts'
import type { SpawnContext } from '../spawnContext'
import type { BranchSighting, ObservedSpawn, TranscriptSpawns } from '../spawnObserver'

function agent(id: string, meta: Record<string, unknown> | null): AgentTreeInput {
  return {
    agentId: toAgentId(id),
    metaStatus:
      meta === null
        ? { status: 'absent' }
        : { status: 'ok', meta: { agentType: 'general-purpose', ...meta } }
  }
}

function transcript(
  spawns: Record<string, ObservedSpawn> = {},
  lastBranch?: BranchSighting
): TranscriptSpawns {
  return { spawns: new Map(Object.entries(spawns)), lastBranch }
}

const lead = transcript(
  {
    t1: { cwd: '/repo', baseBranch: 'feat/one' },
    t2: { cwd: '/other', baseBranch: undefined }
  },
  { branch: 'main', cwd: '/lead' }
)

function resolve(
  subagents: AgentTreeInput[],
  others: Record<string, TranscriptSpawns> = {}
): ReadonlyMap<AgentId, SpawnContext> {
  return resolveSpawnContexts({
    subagents,
    leadTranscript: lead,
    subagentTranscripts: new Map(Object.entries(others).map(([id, t]) => [toAgentId(id), t]))
  })
}

describe('resolveSpawnContexts', () => {
  it('uses the spawn named by toolUseId in the lead transcript, not inferred', () => {
    const result = resolve([agent('a', { toolUseId: 't1' })])

    expect(result.get(toAgentId('a'))).toEqual({
      cwd: '/repo',
      baseBranch: 'feat/one',
      inferred: false
    })
  })

  it('keeps a no-base spawn as a resolved context', () => {
    const result = resolve([agent('a', { toolUseId: 't2' })])

    expect(result.get(toAgentId('a'))).toEqual({
      cwd: '/other',
      baseBranch: undefined,
      inferred: false
    })
  })

  it('looks up toolUseId only in the parent transcript', () => {
    const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p', toolUseId: 't1' })], {
      p: transcript({}, { branch: 'agent/p', cwd: '/wt' })
    })

    expect(result.get(toAgentId('c'))).toEqual({
      cwd: '/wt',
      baseBranch: 'agent/p',
      inferred: true
    })
  })

  it('resolves a nested spawn exactly from the parent transcript', () => {
    const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p', toolUseId: 'tn' })], {
      p: transcript({ tn: { cwd: '/wt', baseBranch: 'agent/p' } })
    })

    expect(result.get(toAgentId('c'))).toEqual({
      cwd: '/wt',
      baseBranch: 'agent/p',
      inferred: false
    })
  })

  it('walks past an ancestor with no readable transcript to the next one', () => {
    const result = resolve(
      [agent('g', {}), agent('p', { parentAgentId: 'g' }), agent('c', { parentAgentId: 'p' })],
      { g: transcript({}, { branch: 'agent/g', cwd: '/gwt' }) }
    )

    expect(result.get(toAgentId('c'))).toEqual({
      cwd: '/gwt',
      baseBranch: 'agent/g',
      inferred: true
    })
  })

  it('ends the walk on a parent cycle and falls back to the lead', () => {
    const result = resolve([agent('a', { parentAgentId: 'b' }), agent('b', { parentAgentId: 'a' })])

    expect(result.get(toAgentId('a'))).toEqual({
      cwd: '/lead',
      baseBranch: 'main',
      inferred: true
    })
    expect(result.get(toAgentId('b'))?.inferred).toBe(true)
  })

  it('falls back to the lead branch and cwd for a teammate with no toolUseId', () => {
    const result = resolve([agent('t', { teamName: 'core' })])

    expect(result.get(toAgentId('t'))).toEqual({ cwd: '/lead', baseBranch: 'main', inferred: true })
  })

  it('does not resolve a self-parent exactly from its own transcript', () => {
    const result = resolve([agent('s', { parentAgentId: 's', toolUseId: 'own' })], {
      s: transcript({ own: { cwd: '/self', baseBranch: 'self' } }, { branch: 'self', cwd: '/self' })
    })

    expect(result.get(toAgentId('s'))).toEqual({ cwd: '/lead', baseBranch: 'main', inferred: true })
  })

  it("does not let a cycle member inherit its partner's last branch", () => {
    const result = resolve(
      [agent('a', { parentAgentId: 'b' }), agent('b', { parentAgentId: 'a' })],
      { b: transcript({}, { branch: 'agent/b', cwd: '/bwt' }) }
    )

    expect(result.get(toAgentId('a'))?.baseBranch).toBe('main')
  })

  it('treats a parentAgentId naming no known subagent as the lead', () => {
    const result = resolve([agent('a', { parentAgentId: 'ghost', toolUseId: 't1' })])

    expect(result.get(toAgentId('a'))?.inferred).toBe(false)
  })

  it('falls back to the lead for a subagent with no meta', () => {
    expect(resolve([agent('n', null)]).get(toAgentId('n'))?.cwd).toBe('/lead')
  })

  it('keeps the first entry for a repeated agent id', () => {
    const result = resolve([agent('a', { toolUseId: 't1' }), agent('a', { toolUseId: 't2' })])

    expect(result.get(toAgentId('a'))?.cwd).toBe('/repo')
  })

  it('leaves a subagent out when nothing resolves', () => {
    const result = resolveSpawnContexts({
      subagents: [agent('a', {})],
      leadTranscript: transcript(),
      subagentTranscripts: new Map()
    })

    expect(result.size).toBe(0)
  })
})
