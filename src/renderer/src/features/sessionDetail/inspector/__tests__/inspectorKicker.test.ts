import { describe, expect, it } from 'vitest'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testGraphNode } from '../../graph/testGraphNode'
import { testSessionDetailT } from '../../testSessionDetailT'
import { inspectorKicker } from '../inspectorKicker'

const kicker = (overrides: Parameters<typeof testGraphNode>[1]): string =>
  inspectorKicker(testGraphNode('x', overrides), testSessionDetailT)

describe('inspectorKicker', () => {
  it('names the lead', () => {
    expect(kicker({ kind: 'lead' })).toBe('Lead session')
  })

  it('names a teammate in a session of its own, and the root of a teammate’s session', () => {
    expect(kicker({ kind: 'teammate', selection: { kind: 'teammate', ref: testRef(2) } })).toBe(
      'Teammate · own session'
    )
    expect(kicker({ kind: 'teammate', selection: null })).toBe('Teammate · own session')
  })

  it('names a teammate that lives in the lead’s transcript', () => {
    const selection = { kind: 'subagent', ownerRef: testRef(1), agentId: 'a1' } as const

    expect(kicker({ kind: 'teammate', selection })).toBe("Teammate · in the lead's session")
  })

  it('names a subagent by its type', () => {
    expect(kicker({ kind: 'subagent', agentType: 'Explore' })).toBe('Subagent · Explore')
  })

  it('names a subagent with no known type without one', () => {
    expect(kicker({ kind: 'subagent', agentType: null })).toBe('Subagent')
  })
})
