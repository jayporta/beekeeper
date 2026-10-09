import { describe, expect, it } from 'vitest'
import type { AgentReport } from '../../../core/session/agentReports'
import { EMPTY_AGENT_SIGNALS } from '../../../core/transcript/signals/agentSignals'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../shared/ipc/emptyAgentSignals'
import { mapAgentReport } from '../mapAgentReport'

const REPORT: AgentReport = {
  usage: { tokenGroups: [], messageCount: 2, skippedLines: 1 },
  fileTouches: [
    { filePath: '/repo/a.ts', operation: 'edit', source: 'edit-write', toolUseId: 'toolu_1' },
    { filePath: '/repo/gone.ts', operation: 'delete', source: 'bash', toolUseId: 'toolu_2' }
  ],
  fileListIncomplete: true,
  activity: { earliestMs: 1000, latestMs: 3000, activeMs: 1500 },
  signals: {
    toolErrors: 12,
    longestErrorStreak: 4,
    longestBashRepeat: 3,
    compactions: 2,
    agentsKilled: 1,
    longestToolWait: { ms: 90_000, tool: 'Bash' },
    partial: true
  }
}

describe('mapAgentReport activity', () => {
  it('maps the span to its earliest and latest milliseconds and its active time', () => {
    expect(mapAgentReport(REPORT).activity).toEqual({
      earliestMs: 1000,
      latestMs: 3000,
      activeMs: 1500
    })
  })

  it('maps an agent with no span to null', () => {
    expect(mapAgentReport({ ...REPORT, activity: null }).activity).toBeNull()
  })
})

describe('mapAgentReport file touches', () => {
  it('maps each touch to its path, operation and source only', () => {
    expect(mapAgentReport(REPORT).fileTouches).toEqual([
      { filePath: '/repo/a.ts', operation: 'edit', source: 'edit-write' },
      { filePath: '/repo/gone.ts', operation: 'delete', source: 'bash' }
    ])
  })

  it('passes the incomplete flag through', () => {
    expect(mapAgentReport(REPORT).fileListIncomplete).toBe(true)
    expect(mapAgentReport({ ...REPORT, fileListIncomplete: false }).fileListIncomplete).toBe(false)
  })
})

describe('mapAgentReport signals', () => {
  it('copies every signal field', () => {
    expect(mapAgentReport(REPORT).signals).toEqual({
      toolErrors: 12,
      longestErrorStreak: 4,
      longestBashRepeat: 3,
      compactions: 2,
      agentsKilled: 1,
      longestToolWait: { ms: 90_000, tool: 'Bash' },
      partial: true
    })
  })

  it('copies the longest wait as a new object', () => {
    const mapped = mapAgentReport(REPORT).signals.longestToolWait
    expect(mapped).not.toBe(REPORT.signals.longestToolWait)
  })

  it('maps no wait to null', () => {
    const report = { ...REPORT, signals: { ...REPORT.signals, longestToolWait: null } }
    expect(mapAgentReport(report).signals.longestToolWait).toBeNull()
  })

  it('maps empty signals to the empty signals DTO', () => {
    const report = { ...REPORT, signals: EMPTY_AGENT_SIGNALS }
    expect(mapAgentReport(report).signals).toEqual(EMPTY_AGENT_SIGNALS_DTO)
  })
})
