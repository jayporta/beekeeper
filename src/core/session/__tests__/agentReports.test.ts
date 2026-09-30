import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { subagentIdentity } from '../agentIdentity'
import { applyAgentReports } from '../agentReports'
import type { AgentReports } from '../collectAgentReports'
import { createFilesLedger } from '../filesLedger'
import { createUsageLedger } from '../usageLedger'

const NO_REPORTS: AgentReports = {
  reports: [],
  fileTouches: [],
  incompleteToolUseIds: [],
  incompleteOverflowed: false,
  skippedLines: 0
}

describe('applyAgentReports incomplete results', () => {
  const identity = subagentIdentity(toAgentId('atask1'))

  it('marks the agent incomplete when its incomplete results overflowed the collector', () => {
    const filesLedger = createFilesLedger()

    applyAgentReports({
      usageLedger: createUsageLedger(),
      filesLedger,
      identity,
      agentReports: { ...NO_REPORTS, incompleteOverflowed: true }
    })

    expect(filesLedger.incompleteOwners()).toEqual([identity])
  })

  it('marks the agent incomplete for each incomplete result it reported', () => {
    const filesLedger = createFilesLedger()

    applyAgentReports({
      usageLedger: createUsageLedger(),
      filesLedger,
      identity,
      agentReports: { ...NO_REPORTS, incompleteToolUseIds: ['toolu_1'] }
    })

    expect(filesLedger.incompleteOwners()).toEqual([identity])
  })

  it('marks nobody for an agent with no incomplete results', () => {
    const filesLedger = createFilesLedger()

    applyAgentReports({
      usageLedger: createUsageLedger(),
      filesLedger,
      identity,
      agentReports: NO_REPORTS
    })

    expect(filesLedger.incompleteOwners()).toEqual([])
  })
})
