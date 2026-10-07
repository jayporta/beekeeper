import { describe, expect, it } from 'vitest'
import type { AgentReport } from '../../../core/session/agentReports'
import { mapAgentReport } from '../mapAgentReport'

const REPORT: AgentReport = {
  usage: { tokenGroups: [], messageCount: 2, skippedLines: 1 },
  fileTouches: [
    { filePath: '/repo/a.ts', operation: 'edit', source: 'edit-write', toolUseId: 'toolu_1' },
    { filePath: '/repo/gone.ts', operation: 'delete', source: 'bash', toolUseId: 'toolu_2' }
  ],
  fileListIncomplete: true,
  activity: { earliestMs: 1000, latestMs: 3000, activeMs: 1500 }
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
