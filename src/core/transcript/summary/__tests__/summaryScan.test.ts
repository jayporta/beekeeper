import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../shared/result'
import { buildAssistantToolUseRecord, buildUserToolResultRecord } from '../../testFileTouchFixtures'
import {
  buildAiTitleRecord,
  buildAssistantRecord,
  buildCostStateRecord,
  buildQuotaRejectionRecord
} from '../../testFixtures'
import { buildTaskStopRecord, buildTeammateSpawnRecord } from '../../testTeammateFixtures'
import { buildSessionSummary } from '../testSessionSummary'
import {
  createSummaryScan,
  SUMMARY_SCAN_BASE_WEIGHT,
  type SummaryScan,
  type SummaryScanInput
} from '../summaryScan'
import { TRACKED_MESSAGE_OVERHEAD } from '../transcriptTokenObserver'

/** A mixed run of lines that exercises every part of the summary, and a line that could not be read. */
const MIXED_LINES: readonly SummaryScanInput[] = [
  ok(buildAiTitleRecord('First title')),
  ok(buildAssistantRecord({ messageId: 'msg_1', timestamp: '2026-01-01T00:05:00.000Z' })),
  ok(
    buildAssistantToolUseRecord({ toolUseId: 'tool_1', toolName: 'Bash', input: { command: 'ls' } })
  ),
  err({ reason: 'invalid-json' }),
  ok(buildUserToolResultRecord({ toolUseId: 'tool_1', isError: true })),
  ok(buildTeammateSpawnRecord({ name: 'scout', team: 'team-1' })),
  ok(buildTaskStopRecord({ taskId: 'scout@team-1' })),
  ok(buildQuotaRejectionRecord()),
  ok(buildAssistantRecord({ messageId: 'msg_2', timestamp: '2026-01-01T00:01:00.000Z' })),
  ok(buildCostStateRecord()),
  ok(buildAiTitleRecord('Second title'))
]

function observeAll(scan: SummaryScan, lines: readonly SummaryScanInput[]): void {
  for (const line of lines) scan.observe(line)
}

describe('createSummaryScan', () => {
  it('summarizes an empty transcript as an empty lead session', () => {
    expect(createSummaryScan().summary()).toEqual(buildSessionSummary())
  })

  it('counts a line that could not be read as skipped and nothing else', () => {
    const scan = createSummaryScan()
    scan.observe(err({ reason: 'line-too-long' }))

    expect(scan.summary()).toEqual(buildSessionSummary({ skippedLines: 1 }))
  })

  it('reports the same summary whether or not it was read between lines', () => {
    const undisturbed = createSummaryScan()
    observeAll(undisturbed, MIXED_LINES)
    const disturbed = createSummaryScan()
    for (const line of MIXED_LINES) {
      disturbed.observe(line)
      disturbed.summary()
    }

    expect(disturbed.summary()).toEqual(undisturbed.summary())
  })

  it('leaves a summary it already returned unchanged by the lines observed after it', () => {
    const scan = createSummaryScan()
    observeAll(scan, MIXED_LINES.slice(0, 6))
    const earlier = scan.summary()
    const snapshot = structuredClone(earlier)

    observeAll(scan, MIXED_LINES.slice(6))

    expect(earlier).toEqual(snapshot)
  })

  it('keeps the last valid cost-state as the recorded usage', () => {
    const scan = createSummaryScan()
    scan.observe(ok(buildCostStateRecord({ totalCostUSD: 1 })))
    scan.observe(ok(buildCostStateRecord({ totalCostUSD: 'not a number' })))

    expect(scan.summary().usage).toMatchObject({ totalUSD: 1 })
  })

  describe('weight', () => {
    it('starts at the base weight', () => {
      expect(createSummaryScan().weight()).toBe(SUMMARY_SCAN_BASE_WEIGHT)
    })

    it('adds what the token observer holds', () => {
      const scan = createSummaryScan()
      scan.observe(ok(buildAssistantRecord({ messageId: 'msg_a', model: 'model-one' })))

      expect(scan.weight()).toBe(
        SUMMARY_SCAN_BASE_WEIGHT + TRACKED_MESSAGE_OVERHEAD + 'msg_a'.length + 'model-one'.length
      )
    })

    it('grows with the tool calls, results and teammates it has observed', () => {
      const scan = createSummaryScan()
      const weights = [scan.weight()]
      for (const record of [
        buildAssistantToolUseRecord({ toolUseId: 'tool_1', toolName: 'Read' }),
        buildUserToolResultRecord({ toolUseId: 'tool_1' }),
        buildTeammateSpawnRecord()
      ]) {
        scan.observe(ok(record))
        weights.push(scan.weight())
      }

      expect(
        weights.every((weight, index) => index === 0 || weight > (weights[index - 1] ?? 0))
      ).toBe(true)
    })

    it('does not grow with the size of a cost-state record, which is reduced as it is read', () => {
      const scan = createSummaryScan()
      const modelUsage = Object.fromEntries(
        Array.from({ length: 2000 }, (_, n) => [`model-${n}`, { inputTokens: 1 }])
      )

      scan.observe(ok(buildCostStateRecord({ modelUsage })))

      expect(scan.weight()).toBe(SUMMARY_SCAN_BASE_WEIGHT)
    })
  })
})
