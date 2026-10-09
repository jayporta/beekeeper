import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../shared/ipc/emptyAgentSignals'
import { signalNotes, signalTotalsOf } from '../signalNotes'
import {
  testLeadTeam,
  testRef,
  testSession,
  testTeammateTeam,
  testUsage
} from '../testSessionFixtures'
import { testSessionsT } from '../testSessionsT'

const COUNTS = { toolErrors: 12, compactions: 2, agentsKilled: 0 }

describe('signalNotes', () => {
  it('gives no notes for no totals', () => {
    expect(signalNotes(null, testSessionsT)).toEqual([])
  })

  it('gives no notes for zero totals', () => {
    expect(signalNotes({ toolErrors: 0, compactions: 0, agentsKilled: 0 }, testSessionsT)).toEqual(
      []
    )
  })

  it('names tool errors then compactions, leaving a zero count out', () => {
    expect(signalNotes(COUNTS, testSessionsT)).toEqual(['12 tool errors', '2 compactions'])
  })

  it('uses the singular for a count of one', () => {
    const totals = { toolErrors: 1, compactions: 1, agentsKilled: 1 }

    expect(signalNotes(totals, testSessionsT)).toEqual([
      '1 tool error',
      '1 compaction',
      '1 agent kill'
    ])
  })

  it('names agent kills last', () => {
    const totals = { toolErrors: 0, compactions: 0, agentsKilled: 3 }

    expect(signalNotes(totals, testSessionsT)).toEqual(['3 agent kills'])
  })
})

describe('signalTotalsOf', () => {
  const own = { ...EMPTY_AGENT_SIGNALS_DTO, toolErrors: 4, compactions: 1, agentsKilled: 2 }

  it('uses the summary signals for a session with no team', () => {
    expect(signalTotalsOf(testSession(1, { signals: own }))).toEqual({
      toolErrors: 4,
      compactions: 1,
      agentsKilled: 2
    })
  })

  it('uses the team totals, not its own summary, for a lead with teammates', () => {
    const item = testSession(1, {
      signals: own,
      team: testLeadTeam([testRef(2)], testUsage({ signalTotals: COUNTS }))
    })

    expect(signalTotalsOf(item)).toEqual(COUNTS)
  })

  it('uses the summary signals for a teammate', () => {
    const item = testSession(2, { signals: own, team: testTeammateTeam(testRef(1)) })

    expect(signalTotalsOf(item)).toEqual({ toolErrors: 4, compactions: 1, agentsKilled: 2 })
  })

  it('gives null for a session whose summary failed to read', () => {
    expect(signalTotalsOf(testSession(1, { unreadable: true }))).toBeNull()
  })
})
