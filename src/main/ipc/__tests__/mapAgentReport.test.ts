import { describe, expect, it } from 'vitest'
import type { AgentReport } from '../../../core/session/agentReports'
import { mapAgentReport } from '../mapAgentReport'

const REPORT: AgentReport = {
  usage: { tokenGroups: [], messageCount: 2, skippedLines: 1 },
  fileTouches: [
    { filePath: '/repo/a.ts', operation: 'edit', source: 'edit-write', toolUseId: 'toolu_1' },
    { filePath: '/repo/gone.ts', operation: 'delete', source: 'bash', toolUseId: 'toolu_2' }
  ],
  fileListIncomplete: true
}

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
