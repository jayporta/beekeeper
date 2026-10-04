import { describe, expect, it } from 'vitest'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import type { AgentGraphNode } from '../agentGraphNode'
import { selectedAgentKey } from '../selectedAgentKey'
import { testGraphNode } from '../testGraphNode'

const OWNER = testRef(1)
const MATE = testRef(2, '-other')

const subagent = testGraphNode('sub:a1', {
  selection: { kind: 'subagent', ownerRef: OWNER, agentId: 'a1' }
})
const sameIdElsewhere = testGraphNode('sub:a1-elsewhere', {
  selection: { kind: 'subagent', ownerRef: MATE, agentId: 'a1' }
})
const teammate = testGraphNode('mate:2', { selection: { kind: 'teammate', ref: MATE } })
const NODES: readonly AgentGraphNode[] = [
  testGraphNode('lead'),
  subagent,
  sameIdElsewhere,
  teammate
]

describe('selectedAgentKey', () => {
  it('is the lead when nothing is selected', () => {
    expect(selectedAgentKey(NODES, null)).toBe('lead')
  })

  it('finds a subagent by its agent id', () => {
    expect(selectedAgentKey(NODES, { kind: 'subagent', ownerRef: OWNER, agentId: 'a1' })).toBe(
      'sub:a1'
    )
  })

  it('tells apart a subagent with the same id in another session', () => {
    expect(selectedAgentKey(NODES, { kind: 'subagent', ownerRef: MATE, agentId: 'a1' })).toBe(
      'sub:a1-elsewhere'
    )
  })

  it('finds a teammate by its session, in whichever folder it lives', () => {
    expect(selectedAgentKey(NODES, { kind: 'teammate', ref: MATE })).toBe('mate:2')
  })

  it('tells a teammate from a session of the same id in another folder', () => {
    expect(selectedAgentKey(NODES, { kind: 'teammate', ref: testRef(2) })).toBe('lead')
  })

  it('falls back to the lead for a subagent that is not in the graph', () => {
    expect(selectedAgentKey(NODES, { kind: 'subagent', ownerRef: OWNER, agentId: 'gone' })).toBe(
      'lead'
    )
  })

  it('falls back to the lead for a teammate that is not in the graph', () => {
    expect(selectedAgentKey(NODES, { kind: 'teammate', ref: testRef(9) })).toBe('lead')
  })
})
