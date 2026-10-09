import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_SIGNAL_EVENTS_PER_TRANSCRIPT } from '../../transcript/signals/signalObserver'
import { buildSystemRecord } from '../../transcript/signals/testSignalFixtures'
import {
  buildAssistantToolUseRecord,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { buildJsonlText } from '../../transcript/testFixtures'
import { scanSession } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

/** The lead's errored Read call, as a transcript. */
const leadHistory = [
  buildAssistantToolUseRecord({ toolUseId: 'toolu_lead', toolName: 'Read' }),
  buildUserToolResultRecord({ toolUseId: 'toolu_lead', isError: true })
]

describe('scanSession signals', () => {
  it("counts a lead's tool errors", async () => {
    const leadPath = dir.writeLead(buildJsonlText(leadHistory))

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.signals.toolErrors).toBe(1)
  })

  it("counts a lead's compactions", async () => {
    const leadPath = dir.writeLead(
      buildJsonlText([buildSystemRecord({ subtype: 'compact_boundary', uuid: 'u1' })])
    )

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.signals.compactions).toBe(1)
  })

  it("leaves the lead's errored result with the lead when a fork copies it", async () => {
    const leadPath = dir.writeLead(buildJsonlText(leadHistory))
    const fork = dir.addSubagent('forked', {
      transcript: buildJsonlText([
        ...leadHistory,
        buildUserToolResultRecord({ toolUseId: 'toolu_fork', isError: true })
      ])
    })

    const scan = await scanSession({ leadPath, subagents: [fork] })

    expect(scan.lead.signals.toolErrors).toBe(1)
  })

  it("counts only a fork's own errored results, not its copy of the lead's", async () => {
    const leadPath = dir.writeLead(buildJsonlText(leadHistory))
    const fork = dir.addSubagent('forked', {
      transcript: buildJsonlText([
        ...leadHistory,
        buildUserToolResultRecord({ toolUseId: 'toolu_fork', isError: true })
      ])
    })

    const scan = await scanSession({ leadPath, subagents: [fork] })

    const report = scan.subagents.get(fork.agentId)
    expect(report?.ok ? report.value.signals.toolErrors : undefined).toBe(1)
  })

  it('counts a tool result repeated within one transcript once', async () => {
    const leadPath = dir.writeLead(buildJsonlText([...leadHistory, leadHistory[1]]))

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.signals.toolErrors).toBe(1)
  })

  it('marks the lead partial when its transcript passes the per-transcript cap', async () => {
    const results = Array.from({ length: MAX_SIGNAL_EVENTS_PER_TRANSCRIPT + 1 }, (_, index) =>
      buildUserToolResultRecord({ toolUseId: `toolu_${index}`, isError: true })
    )
    const leadPath = dir.writeLead(buildJsonlText(results))

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.signals.partial).toBe(true)
  })

  it('leaves the lead complete when its transcript is within the cap', async () => {
    const leadPath = dir.writeLead(buildJsonlText(leadHistory))

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.signals.partial).toBe(false)
  })

  it('gives an agent with no events empty signals', async () => {
    const leadPath = dir.writeLead('')

    const scan = await scanSession({ leadPath, subagents: [] })

    expect(scan.lead.signals).toEqual({
      toolErrors: 0,
      longestErrorStreak: 0,
      longestBashRepeat: 0,
      compactions: 0,
      agentsKilled: 0,
      longestToolWait: null,
      partial: false
    })
  })
})
