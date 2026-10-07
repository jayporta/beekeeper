import { describe, expect, it } from 'vitest'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { inspectionTarget } from '../inspectionTarget'

const SESSION = testRef(1)

describe('inspectionTarget', () => {
  it('is the viewed session’s own agent for no selection', () => {
    expect(inspectionTarget(null, SESSION)).toEqual({
      ownerRef: SESSION,
      agentId: null
    })
  })

  it('is the teammate’s own session, and its own agent, for a teammate selection', () => {
    expect(inspectionTarget({ kind: 'teammate', ref: testRef(2, '-other') }, SESSION)).toEqual({
      ownerRef: testRef(2, '-other'),
      agentId: null
    })
  })

  it('is the session that holds the subagent, and its id, for a subagent selection', () => {
    const owner = testRef(2, '-other')
    expect(inspectionTarget({ kind: 'subagent', ownerRef: owner, agentId: 'w1' }, SESSION)).toEqual(
      { ownerRef: owner, agentId: 'w1' }
    )
  })
})
