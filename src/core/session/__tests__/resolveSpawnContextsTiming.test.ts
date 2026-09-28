import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { resolveAgentHierarchy } from '../agentHierarchy'
import { MAX_ANCESTOR_DEPTH, resolveSpawnContexts } from '../resolveSpawnContexts'
import { buildSighting } from '../testSpawnFixtures'
import { agent, resolve, startedAt, transcript } from '../testResolveSpawnContextsFixtures'

describe('resolveSpawnContexts', () => {
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
        hierarchy: resolveAgentHierarchy([agent('p', {}), agent('c', { parentAgentId: 'p' })]),
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
