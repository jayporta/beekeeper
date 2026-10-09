import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import type { AgentSignalsDto } from '../../../../../../shared/ipc/agentDto'
import { testSessionsT } from '../../../sessions/testSessionsT'
import { testGraphT } from '../../graph/testGraphT'
import { signalRows, type SignalRow } from '../signalRows'

const HOUR_MS = 3_600_000

const rowsOf = (overrides: Partial<AgentSignalsDto> = {}, showKills = true): readonly SignalRow[] =>
  signalRows(
    { signals: { ...EMPTY_AGENT_SIGNALS_DTO, ...overrides }, showKills, tSessions: testSessionsT },
    testGraphT
  )

const valueOf = (rows: readonly SignalRow[], key: SignalRow['key']): string | undefined =>
  rows.find((row) => row.key === key)?.value

describe('signalRows', () => {
  it('omits the agents killed row when the agent does not show kills', () => {
    expect(rowsOf({}, false).map((row) => row.key)).not.toContain('agentsKilled')
  })

  it('keeps the agents killed row at zero when the agent shows kills', () => {
    expect(valueOf(rowsOf({}, true), 'agentsKilled')).toBe('0')
  })

  it('says there are no repeats below two', () => {
    expect(valueOf(rowsOf({ longestBashRepeat: 1 }), 'bashRepeat')).toBe('No repeats')
  })

  it('gives the repeat count from two up', () => {
    expect(valueOf(rowsOf({ longestBashRepeat: 4 }), 'bashRepeat')).toBe('4')
  })

  it('says none when there is no tool wait', () => {
    expect(valueOf(rowsOf({ longestToolWait: null }), 'longestWait')).toBe('None')
  })

  it('formats a wait of fifty hours as hours with the tool name', () => {
    const rows = rowsOf({ longestToolWait: { ms: 50 * HOUR_MS, tool: 'Bash' } })

    expect(valueOf(rows, 'longestWait')).toBe('50h (Bash)')
  })

  it('gives the error count alone when there are no errors', () => {
    expect(valueOf(rowsOf({ toolErrors: 0, longestErrorStreak: 0 }), 'toolErrors')).toBe('0')
  })

  it('adds the longest streak when there are errors', () => {
    const rows = rowsOf({ toolErrors: 12, longestErrorStreak: 3 })

    expect(valueOf(rows, 'toolErrors')).toBe('12 (longest streak 3)')
  })
})
