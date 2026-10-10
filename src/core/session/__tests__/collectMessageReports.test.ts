import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from '../../shared/result'
import type { SkippedLineError } from '../../transcript/readRecords'
import { buildAssistantRecord } from '../../transcript/testFixtures'
import { subagentIdentity } from '../agentIdentity'
import {
  collectMessageReports,
  createMessageReportCollector,
  MESSAGE_REPORT_OVERHEAD
} from '../collectMessageReports'
import { toAgentId } from '../../transcript/ids'

type RecordResult = Result<Record<string, unknown>, SkippedLineError>

async function* recordsOf(...results: RecordResult[]): AsyncGenerator<RecordResult> {
  for (const result of results) yield result
}

describe('collectMessageReports', () => {
  const identity = subagentIdentity(toAgentId('a1'))

  it('reports each valid assistant record under the given identity', async () => {
    const { reports, skippedLines } = await collectMessageReports(
      recordsOf(
        ok(buildAssistantRecord({ messageId: 'msg_1', inputTokens: 3, outputTokens: 4 })),
        ok({ type: 'user' })
      ),
      identity
    )

    expect(skippedLines).toBe(0)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      identity,
      messageId: 'msg_1',
      tokens: { input: 3, output: 4 }
    })
  })

  it('counts a skipped line and an assistant record that fails validation', async () => {
    const { reports, skippedLines } = await collectMessageReports(
      recordsOf(err({ reason: 'invalid-json' }), ok({ type: 'assistant', message: {} })),
      identity
    )

    expect(reports).toEqual([])
    expect(skippedLines).toBe(2)
  })
})

describe('createMessageReportCollector', () => {
  const identity = subagentIdentity(toAgentId('a1'))
  const LINES: readonly RecordResult[] = [
    ok(buildAssistantRecord({ messageId: 'msg_1', inputTokens: 3 })),
    err({ reason: 'invalid-json' }),
    ok({ type: 'assistant', message: {} }),
    ok(buildAssistantRecord({ messageId: 'msg_2', inputTokens: 5 }))
  ]

  it('collects what the one-shot read of the same lines collects', async () => {
    const collector = createMessageReportCollector(identity)
    for (const line of LINES) collector.observe(line)

    expect(collector.result()).toEqual(await collectMessageReports(recordsOf(...LINES), identity))
  })

  it('reports more once more lines are observed after a result was read', () => {
    const collector = createMessageReportCollector(identity)
    collector.observe(LINES[0] as RecordResult)
    expect(collector.result().reports).toHaveLength(1)

    collector.observe(LINES[3] as RecordResult)

    expect(collector.result().reports.map((report) => report.messageId)).toEqual(['msg_1', 'msg_2'])
  })

  describe('weight', () => {
    it('is zero before any report', () => {
      const collector = createMessageReportCollector(identity)
      collector.observe(err({ reason: 'invalid-json' }))

      expect(collector.weight()).toBe(0)
    })

    it('charges each report its overhead, its message id, its model and its speed', () => {
      const collector = createMessageReportCollector(identity)
      collector.observe(
        ok(
          buildAssistantRecord({
            messageId: 'msg_1',
            model: 'model-one',
            usageExtra: { speed: 'fast' }
          })
        )
      )

      expect(collector.weight()).toBe(
        MESSAGE_REPORT_OVERHEAD + 'msg_1'.length + 'model-one'.length + 'fast'.length
      )
    })

    it('charges a repeated message id again, since every record is kept', () => {
      const collector = createMessageReportCollector(identity)
      const record = ok(buildAssistantRecord({ messageId: 'msg_1', model: 'm' }))
      collector.observe(record)
      const once = collector.weight()
      collector.observe(record)

      expect(collector.weight()).toBe(2 * once)
    })

    it('does not charge an assistant record that fails validation', () => {
      const collector = createMessageReportCollector(identity)
      collector.observe(ok({ type: 'assistant', message: {} }))

      expect(collector.weight()).toBe(0)
    })
  })
})
