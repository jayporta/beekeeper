import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { agentIdentityKey, subagentIdentity } from '../agentIdentity'
import { applyAgentReports } from '../agentReports'
import type { AgentReports } from '../collectAgentReports'
import { createFilesLedger } from '../filesLedger'
import { createSignalsLedger } from '../signalsLedger'
import { createUsageLedger } from '../usageLedger'

const NO_REPORTS: AgentReports = {
  reports: [],
  fileTouches: [],
  incompleteToolUseIds: [],
  incompleteOverflowed: false,
  signalEvents: [],
  signalsCapped: false,
  skippedLines: 0
}

describe('applyAgentReports incomplete results', () => {
  const identity = subagentIdentity(toAgentId('atask1'))

  it('marks the agent incomplete when its incomplete results overflowed the collector', () => {
    const filesLedger = createFilesLedger()

    applyAgentReports({
      usageLedger: createUsageLedger(),
      filesLedger,
      signalsLedger: createSignalsLedger(),
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
      signalsLedger: createSignalsLedger(),
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
      signalsLedger: createSignalsLedger(),
      identity,
      agentReports: NO_REPORTS
    })

    expect(filesLedger.incompleteOwners()).toEqual([])
  })
})

describe('applyAgentReports signals', () => {
  const identity = subagentIdentity(toAgentId('atask1'))
  const errored = {
    kind: 'tool-result',
    toolUseId: 'toolu_1',
    isError: true,
    atMs: null
  } as const

  it('reports each signal event to the signals ledger', () => {
    const signalsLedger = createSignalsLedger()

    applyAgentReports({
      usageLedger: createUsageLedger(),
      filesLedger: createFilesLedger(),
      signalsLedger,
      identity,
      agentReports: { ...NO_REPORTS, signalEvents: [errored] }
    })

    expect(signalsLedger.entries()).toEqual([{ owner: identity, event: errored }])
  })

  it('marks the agent capped when its transcript dropped events at the cap', () => {
    const signalsLedger = createSignalsLedger()

    applyAgentReports({
      usageLedger: createUsageLedger(),
      filesLedger: createFilesLedger(),
      signalsLedger,
      identity,
      agentReports: { ...NO_REPORTS, signalsCapped: true }
    })

    expect([...signalsLedger.cappedOwners()]).toEqual([agentIdentityKey(identity)])
  })
})
