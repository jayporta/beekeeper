import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import {
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '@renderer/features/sessions/testSessionFixtures'
import { testRow } from '@renderer/features/sessions/testSessionRows'
import { teammateNode } from '../teammateNode'

function nodeWith(
  subagentCount: number | null,
  options: Parameters<typeof testSession>[1] = {}
): ReturnType<typeof teammateNode> {
  const lead = testSession(1, { team: testLeadTeam([testRef(2)], testUsage()) })
  const mate = testSession(2, { subagentCount, team: testTeammateTeam(testRef(1)), ...options })
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

describe('teammateNode marks', () => {
  it('counts the tool errors and compactions in the teammate session summary', () => {
    const signals = { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 3, compactions: 1 }

    expect(nodeWith(0, { signals }).marks).toEqual({ toolErrors: 3, compactions: 1 })
  })

  it('has zero marks, not none, for a teammate whose summary counts nothing', () => {
    expect(nodeWith(0).marks).toEqual({ toolErrors: 0, compactions: 0 })
  })

  it('has no marks for a teammate whose summary could not be read', () => {
    expect(nodeWith(0, { unreadable: true }).marks).toBeNull()
  })
})
