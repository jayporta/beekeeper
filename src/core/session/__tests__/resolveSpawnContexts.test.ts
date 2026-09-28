import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { resolveAgentHierarchy } from '../agentHierarchy'
import { resolveSpawnContexts } from '../resolveSpawnContexts'
import { agent, resolve, transcript } from '../testResolveSpawnContextsFixtures'

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

  it('falls back to the lead branch and cwd for a subagent with no toolUseId', () => {
    const result = resolve([agent('t', {})])

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

  it('uses the first occurrence when the hierarchy dedupes a repeated agent id', () => {
    const result = resolve([agent('a', { toolUseId: 't1' }), agent('a', { toolUseId: 't2' })])

    expect(result.get(toAgentId('a'))?.cwd).toBe('/repo')
  })

  it('leaves a subagent out when nothing resolves', () => {
    const result = resolveSpawnContexts({
      hierarchy: resolveAgentHierarchy([agent('a', {})]),
      leadTranscript: transcript(),
      subagentTranscripts: new Map()
    })

    expect(result.size).toBe(0)
  })
})
