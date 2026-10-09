import { describe, expect, it } from 'vitest'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../../shared/ipc/emptyAgentSignals'
import { testReport } from '../../testSessionDetail'
import { isPartialReport } from '../reportFacts'

describe('isPartialReport', () => {
  it('is false for a complete report', () => {
    expect(isPartialReport(testReport())).toBe(false)
  })

  it('is true when only the signals are partial', () => {
    const report = testReport({ signals: { ...EMPTY_AGENT_SIGNALS_DTO, partial: true } })

    expect(isPartialReport(report)).toBe(true)
  })
})
