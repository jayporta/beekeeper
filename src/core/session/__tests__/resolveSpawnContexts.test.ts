import { describe, expect, it } from 'vitest'
import { toAgentId, type AgentId } from '../../transcript/ids'
import type { AgentTreeInput } from '../agentTree'
import { MAX_ANCESTOR_DEPTH, resolveSpawnContexts } from '../resolveSpawnContexts'
import type { SpawnContext } from '../spawnContext'
import type { BranchSighting, ObservedSpawn, TranscriptSpawns } from '../spawnObserver'
import { buildSighting } from '../testSpawnFixtures'

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
  timeline: BranchSighting[] = []
): TranscriptSpawns {
  return {
    spawns: new Map(Object.entries(spawns)),
    timeline,
    startedAt: undefined,
    firstCwd: undefined
  }
}

function startedAt(base: TranscriptSpawns, at: number | undefined): TranscriptSpawns {
  return { ...base, startedAt: at }
}

const lead = transcript(
  {
    t1: { cwd: '/repo', baseBranch: 'feat/one' },
    t2: { cwd: '/other', baseBranch: undefined }
  },
  [{ branch: 'main', cwd: '/lead', timestamp: 0 }]
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
      p: transcript({}, [{ branch: 'agent/p', cwd: '/wt', timestamp: 0 }])
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
      { g: transcript({}, [{ branch: 'agent/g', cwd: '/gwt', timestamp: 0 }]) }
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
      s: transcript({ own: { cwd: '/self', baseBranch: 'self' } }, [
        { branch: 'self', cwd: '/self', timestamp: 0 }
      ])
    })

    expect(result.get(toAgentId('s'))).toEqual({ cwd: '/lead', baseBranch: 'main', inferred: true })
  })

  it("does not let a cycle member inherit its partner's last branch", () => {
    const result = resolve(
      [agent('a', { parentAgentId: 'b' }), agent('b', { parentAgentId: 'a' })],
      { b: transcript({}, [{ branch: 'agent/b', cwd: '/bwt', timestamp: 0 }]) }
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

  describe('timing', () => {
    it('gives the child the earlier branch when the parent switches after the child starts', () => {
      const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p' })], {
        p: transcript({}, [
          buildSighting('feat/early', { timestamp: 10 }),
          buildSighting('feat/late', { timestamp: 100 })
        ]),
        c: startedAt(transcript(), 50)
      })

      expect(result.get(toAgentId('c'))).toEqual({
        cwd: '/repo',
        baseBranch: 'feat/early',
        inferred: true
      })
    })

    it('picks a grandparent sighting between the parent start and the child start', () => {
      const result = resolve(
        [agent('g', {}), agent('p', { parentAgentId: 'g' }), agent('c', { parentAgentId: 'p' })],
        {
          g: transcript({}, [
            buildSighting('feat/one', { timestamp: 5 }),
            buildSighting('feat/two', { timestamp: 30 }),
            buildSighting('feat/three', { timestamp: 90 })
          ]),
          p: startedAt(transcript(), 20),
          c: startedAt(transcript(), 50)
        }
      )

      expect(result.get(toAgentId('c'))?.baseBranch).toBe('feat/two')
    })

    it('continues to the next ancestor when the parent has nothing at or before the start', () => {
      const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p' })], {
        p: transcript({}, [buildSighting('feat/late', { timestamp: 100 })]),
        c: startedAt(transcript(), 50)
      })

      expect(result.get(toAgentId('c'))).toEqual({
        cwd: '/lead',
        baseBranch: 'main',
        inferred: true
      })
    })

    it('picks by file order when timestamps step backwards', () => {
      const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p' })], {
        p: transcript({}, [
          buildSighting('feat/a', { timestamp: 10 }),
          buildSighting('feat/b', { timestamp: 100 }),
          buildSighting('feat/c', { timestamp: 40 }),
          buildSighting('feat/d', { timestamp: 90 })
        ]),
        c: startedAt(transcript(), 50)
      })

      expect(result.get(toAgentId('c'))?.baseBranch).toBe('feat/c')
    })

    it('borrows the nearest earlier same-cwd branch for a HEAD pick', () => {
      const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p' })], {
        p: transcript({}, [
          buildSighting('feat/x', { timestamp: 10 }),
          buildSighting('feat/y', { timestamp: 20, cwd: '/other' }),
          buildSighting('HEAD', { timestamp: 30 })
        ]),
        c: startedAt(transcript(), 50)
      })

      expect(result.get(toAgentId('c'))).toEqual({
        cwd: '/repo',
        baseBranch: 'feat/x',
        inferred: true
      })
    })

    it('gives no base for a HEAD pick when the earlier branch has a different cwd', () => {
      const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p' })], {
        p: transcript({}, [
          buildSighting('feat/x', { timestamp: 10, cwd: '/other' }),
          buildSighting('HEAD', { timestamp: 30 })
        ]),
        c: startedAt(transcript(), 50)
      })

      expect(result.get(toAgentId('c'))).toEqual({
        cwd: '/repo',
        baseBranch: undefined,
        inferred: true
      })
    })

    it('uses the latest entry, flagged inferred, when the child has no start time', () => {
      const result = resolve([agent('p', {}), agent('c', { parentAgentId: 'p' })], {
        p: transcript({}, [
          buildSighting('feat/early', { timestamp: 10 }),
          buildSighting('feat/late', { timestamp: 100 })
        ])
      })

      expect(result.get(toAgentId('c'))).toEqual({
        cwd: '/repo',
        baseBranch: 'feat/late',
        inferred: true
      })
    })

    it('leaves exact spawns unaffected by timing', () => {
      const result = resolve([agent('a', { toolUseId: 't1' })], {
        a: startedAt(transcript(), -1)
      })

      expect(result.get(toAgentId('a'))).toEqual({
        cwd: '/repo',
        baseBranch: 'feat/one',
        inferred: false
      })
    })

    it('leaves a child out when its start precedes every entry at every level', () => {
      const result = resolveSpawnContexts({
        subagents: [agent('p', {}), agent('c', { parentAgentId: 'p' })],
        leadTranscript: transcript({}, [buildSighting('main', { timestamp: 100, cwd: '/lead' })]),
        subagentTranscripts: new Map([
          [toAgentId('p'), transcript({}, [buildSighting('feat/late', { timestamp: 90 })])],
          [toAgentId('c'), startedAt(transcript(), 50)]
        ])
      })

      expect(result.has(toAgentId('c'))).toBe(false)
    })

    it('goes straight to the lead past the ancestor depth cap', () => {
      const depth = MAX_ANCESTOR_DEPTH + 5
      const chain = Array.from({ length: depth }, (_, i) =>
        agent(`p${i}`, i + 1 < depth ? { parentAgentId: `p${i + 1}` } : {})
      )
      const result = resolve([agent('c', { parentAgentId: 'p0' }), ...chain], {
        [`p${depth - 1}`]: transcript({}, [buildSighting('feat/deep', { timestamp: 10 })]),
        c: startedAt(transcript(), 50)
      })

      expect(result.get(toAgentId('c'))?.baseBranch).toBe('main')
    })
  })
})
