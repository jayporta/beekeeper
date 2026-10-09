import { describe, expect, it } from 'vitest'
import { EMPTY_SIGNALS } from '../../transcript/summary/testSessionSummary'
import { sumSignalTotals } from '../signalTotals'
import { testAgent, testLead, testRef } from '../testTeamFixtures'

describe('sumSignalTotals', () => {
  it('sums errors, compactions and kills over the lead and each teammate', () => {
    const lead = testLead(testRef('p', 'lead'), {
      signals: { ...EMPTY_SIGNALS, toolErrors: 5, compactions: 1, agentsKilled: 2 }
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      signals: { ...EMPTY_SIGNALS, toolErrors: 3, compactions: 1 }
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      signals: { ...EMPTY_SIGNALS, toolErrors: 4, agentsKilled: 1 }
    })

    expect(sumSignalTotals([lead, a, b])).toEqual({
      toolErrors: 12,
      compactions: 2,
      agentsKilled: 3
    })
  })

  it('includes a teammate that lives in another folder', () => {
    const lead = testLead(testRef('p', 'lead'), { signals: { ...EMPTY_SIGNALS, toolErrors: 1 } })
    const away = testAgent(testRef('other-folder', 'a'), {
      agentName: 'a',
      teamName: 'team',
      signals: { ...EMPTY_SIGNALS, toolErrors: 6 }
    })

    expect(sumSignalTotals([lead, away]).toolErrors).toBe(7)
  })

  it('gives zeros for sessions with no signals', () => {
    expect(sumSignalTotals([testLead(testRef('p', 'lead'))])).toEqual({
      toolErrors: 0,
      compactions: 0,
      agentsKilled: 0
    })
  })
})
