import { describe, expect, it } from 'vitest'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testGraphNode } from '../../graph/testGraphNode'
import { inspectionTarget } from '../inspectionTarget'

const SESSION = testRef(1)

describe('inspectionTarget', () => {
  it('is the viewed session’s own agent for the root', () => {
    expect(inspectionTarget(testGraphNode('lead'), SESSION)).toEqual({
      ownerRef: SESSION,
      agentId: null
    })
  })

  it('is the teammate’s own session, and its own agent, for a teammate node', () => {
    const node = testGraphNode('mate:x', {
      selection: { kind: 'teammate', ref: testRef(2, '-other') }
    })

    expect(inspectionTarget(node, SESSION)).toEqual({
      ownerRef: testRef(2, '-other'),
      agentId: null
    })
  })

  it('is the session that holds the subagent, and its id, for a subagent node', () => {
    const owner = testRef(2, '-other')
    const node = testGraphNode('sub:x', {
      selection: { kind: 'subagent', ownerRef: owner, agentId: 'w1' }
    })

    expect(inspectionTarget(node, SESSION)).toEqual({ ownerRef: owner, agentId: 'w1' })
  })
})
