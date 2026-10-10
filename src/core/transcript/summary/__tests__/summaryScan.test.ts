import { describe, expect, it } from 'vitest'
import { err, ok } from '../../../shared/result'
import type { LineScanInput } from '../../feedLineScan'
import { buildAssistantToolUseRecord, buildUserToolResultRecord } from '../../testFileTouchFixtures'
import {
  buildAiTitleRecord,
  buildAssistantRecord,
  buildCostStateRecord,
  buildQuotaRejectionRecord
} from '../../testFixtures'
import { buildTaskStopRecord, buildTeammateSpawnRecord } from '../../testTeammateFixtures'
import { buildSessionSummary } from '../testSessionSummary'
import { createSummaryScan, SUMMARY_SCAN_BASE_WEIGHT, type SummaryScan } from '../summaryScan'
import { RECORDED_MODEL_OVERHEAD } from '../recordedCostState'
import { recordTimestampMs } from '../recordTimestampMs'
import { createTranscriptTokenObserver } from '../transcriptTokenObserver'

/** A mixed run of lines that exercises every part of the summary, and a line that could not be read. */
const MIXED_LINES: readonly LineScanInput[] = [
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

function observeAll(scan: SummaryScan, lines: readonly LineScanInput[]): void {
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

  it('keeps only the totals of a cost-state record, not its per-model usage', () => {
    const scan = createSummaryScan()
    const modelUsage = Object.fromEntries(
      Array.from({ length: 2000 }, (_, n) => [`model-${n}`, { inputTokens: 1 }])
    )

    scan.observe(ok(buildCostStateRecord({ totalCostUSD: 3, modelUsage })))

    const { usage } = scan.summary()
    expect(Object.keys(usage ?? {}).sort()).toEqual(['totalTokens', 'totalUSD'])
    expect(JSON.stringify(usage)).not.toContain('model-1999')
  })

  it('counts the tokens of every model in the recorded usage, even one with an unprintable key', () => {
    const scan = createSummaryScan()
    scan.observe(
      ok(
        buildCostStateRecord({
          modelUsage: { 'model-a': { inputTokens: 3 }, ['bad\u0007model']: { outputTokens: 4 } }
        })
      )
    )

    expect(scan.summary().usage?.totalTokens).toBe(7)
  })

  describe('weight', () => {
    it('starts at the base weight', () => {
      expect(createSummaryScan().weight()).toBe(SUMMARY_SCAN_BASE_WEIGHT)
    })

    it('adds what the token observer holds', () => {
      const record = buildAssistantRecord({ messageId: 'msg_a', model: 'model-one' })
      const scan = createSummaryScan()
      const observer = createTranscriptTokenObserver()
      scan.observe(ok(record))
      observer.observe(record, recordTimestampMs(record))

      expect(scan.weight()).toBe(SUMMARY_SCAN_BASE_WEIGHT + observer.weight())
    })

    it('adds what the recorded cost state holds', () => {
      const scan = createSummaryScan()
      scan.observe(
        ok(buildCostStateRecord({ modelUsage: { 'model-a': { inputTokens: 1 }, 'model-bb': {} } }))
      )

      expect(scan.weight()).toBe(
        SUMMARY_SCAN_BASE_WEIGHT +
          RECORDED_MODEL_OVERHEAD +
          2 * RECORDED_MODEL_OVERHEAD +
          'model-a'.length +
          'model-bb'.length
      )
    })

    it('does not grow with a field of the cost state that the summary does not read', () => {
      const plain = createSummaryScan()
      plain.observe(ok(buildCostStateRecord()))
      const padded = createSummaryScan()
      padded.observe(ok(buildCostStateRecord({ unknownTopLevel: 'x'.repeat(100_000) })))

      expect(padded.weight()).toBe(plain.weight())
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
  })
})
