import { describe, expect, it } from 'vitest'
import {
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import { teammateNode } from '../teammateNode'

function nodeWith(subagentCount: number | null): ReturnType<typeof teammateNode> {
  const lead = testSession(1, { team: testLeadTeam([testRef(2)], testUsage()) })
  const mate = testSession(2, { subagentCount, team: testTeammateTeam(testRef(1)) })
  const teammate = testRow(1, [lead, mate]).teammates[0]
  if (teammate === undefined) throw new Error('no teammate row')
  return teammateNode(teammate, testRef(1))
}

describe('teammateNode subagentsNotLoaded', () => {
  it('is false for a teammate with no subagents', () => {
    expect(nodeWith(0).subagentsNotLoaded).toBe(false)
  })

  it('is true for a teammate with subagents, which the node does not hold', () => {
    expect(nodeWith(3).subagentsNotLoaded).toBe(true)
  })

  it('is true for a teammate whose subagent count could not be read', () => {
    expect(nodeWith(null).subagentsNotLoaded).toBe(true)
  })
})
