import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from '../../shared/result'
import type { SkippedLineError } from '../../transcript/readRecords'
import {
  buildAssistantToolUseRecord,
  buildBashToolUseResult,
  buildEditToolUseResult,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { buildAssistantRecord } from '../../transcript/testFixtures'
import { leadIdentity } from '../agentIdentity'
import { collectAgentReports, createAgentReportsFold } from '../collectAgentReports'
import { MAX_BASH_TOUCHES_PER_TRANSCRIPT } from '../fileTouchCollector'
import { MESSAGE_REPORT_OVERHEAD } from '../collectMessageReports'

type RecordResult = Result<Record<string, unknown>, SkippedLineError>

async function* recordsOf(...results: RecordResult[]): AsyncGenerator<RecordResult> {
  for (const result of results) yield result
}

describe('collectAgentReports', () => {
  it('collects a valid assistant record into a report', async () => {
    const { reports } = await collectAgentReports(
      recordsOf(ok(buildAssistantRecord({ messageId: 'msg_1' }))),
      leadIdentity
    )

    expect(reports).toHaveLength(1)
    expect(reports[0]?.messageId).toBe('msg_1')
  })

  it('counts the usage of a record whose unread fields are malformed', async () => {
    const record = buildAssistantRecord({
      messageId: 'msg_1',
      inputTokens: 5,
      outputTokens: 10,
      extra: { isSidechain: 'yes', parentUuid: 42, timestamp: 'not a date' }
    })

    const { reports, skippedLines } = await collectAgentReports(recordsOf(ok(record)), leadIdentity)

    expect(skippedLines).toBe(0)
    expect(reports).toHaveLength(1)
    expect(reports[0]?.tokens).toMatchObject({ input: 5, output: 10 })
  })

  it("carries a record's timestamp on its report as epoch milliseconds", async () => {
    const { reports } = await collectAgentReports(
      recordsOf(ok(buildAssistantRecord({ timestamp: '2026-01-01T00:00:01.500Z' }))),
      leadIdentity
    )

    expect(reports[0]?.timestampMs).toBe(Date.parse('2026-01-01T00:00:01.500Z'))
  })

  it('reports a null timestamp for a record whose timestamp is not a date', async () => {
    const { reports } = await collectAgentReports(
      recordsOf(ok(buildAssistantRecord({ timestamp: 'not a date' }))),
      leadIdentity
    )

    expect(reports[0]?.timestampMs).toBeNull()
  })

  it('counts a skipped-line result without producing a report', async () => {
    const { reports, skippedLines } = await collectAgentReports(
      recordsOf(err({ reason: 'invalid-json' })),
      leadIdentity
    )

    expect(reports).toEqual([])
    expect(skippedLines).toBe(1)
  })

  it('ignores a record of a type other than assistant, without counting it as skipped', async () => {
    const { reports, skippedLines } = await collectAgentReports(
      recordsOf(ok({ type: 'user' })),
      leadIdentity
    )

    expect(reports).toEqual([])
    expect(skippedLines).toBe(0)
  })

  it('counts an assistant record that fails schema validation as skipped', async () => {
    const { reports, skippedLines } = await collectAgentReports(
      recordsOf(ok({ type: 'assistant', message: { model: 'claude-opus-5' } })),
      leadIdentity
    )

    expect(reports).toEqual([])
    expect(skippedLines).toBe(1)
  })

  it('rejects, rather than returning a partial result, when the record source fails partway through', async () => {
    async function* failingAfterFirstRecord(): AsyncGenerator<RecordResult> {
      yield ok(buildAssistantRecord({ messageId: 'msg_1' }))
      throw new Error('simulated mid-read failure')
    }

    await expect(collectAgentReports(failingAfterFirstRecord(), leadIdentity)).rejects.toThrow(
      'simulated mid-read failure'
    )
  })

  it('collects a file touch from the same pass, alongside message reports', async () => {
    const { fileTouches } = await collectAgentReports(
      recordsOf(
        ok(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Edit' })),
        ok(
          buildUserToolResultRecord({
            toolUseId: 'toolu_1',
            toolUseResult: buildEditToolUseResult('/a.ts')
          })
        )
      ),
      leadIdentity
    )

    expect(fileTouches).toEqual([
      { filePath: '/a.ts', operation: 'edit', source: 'edit-write', toolUseId: 'toolu_1' }
    ])
  })

  describe('incomplete Bash results', () => {
    /** Bash calls and results that each report they could not tell what changed. */
    async function* unavailableResults(count: number): AsyncGenerator<RecordResult> {
      for (let index = 0; index < count; index += 1) {
        const toolUseId = `toolu_${index}`
        yield ok(buildAssistantToolUseRecord({ toolUseId, toolName: 'Bash' }))
        yield ok(
          buildUserToolResultRecord({
            toolUseId,
            toolUseResult: buildBashToolUseResult({ unavailable: true })
          })
        )
      }
    }

    it('reports the ids of the incomplete results, without overflow, up to the cap', async () => {
      const reports = await collectAgentReports(
        unavailableResults(MAX_BASH_TOUCHES_PER_TRANSCRIPT),
        leadIdentity
      )

      expect(reports.incompleteToolUseIds).toHaveLength(MAX_BASH_TOUCHES_PER_TRANSCRIPT)
      expect(reports.incompleteOverflowed).toBe(false)
    })

    it('reports the overflow once more incomplete results arrive than the cap keeps', async () => {
      const reports = await collectAgentReports(
        unavailableResults(MAX_BASH_TOUCHES_PER_TRANSCRIPT + 1),
        leadIdentity
      )

      expect(reports.incompleteOverflowed).toBe(true)
    })
  })

  it('reports no file touches when the transcript has none', async () => {
    const { fileTouches } = await collectAgentReports(
      recordsOf(ok(buildAssistantRecord({ messageId: 'msg_1' }))),
      leadIdentity
    )

    expect(fileTouches).toEqual([])
  })

  it('collects signal events from the same pass', async () => {
    const { signalEvents, signalsCapped } = await collectAgentReports(
      recordsOf(ok(buildUserToolResultRecord({ toolUseId: 'toolu_1', isError: true }))),
      leadIdentity
    )

    expect(signalEvents).toMatchObject([
      { kind: 'tool-result', toolUseId: 'toolu_1', isError: true }
    ])
    expect(signalsCapped).toBe(false)
  })
})

describe('createAgentReportsFold', () => {
  /** Lines that give every part of the reports something to hold, and one that can't be read. */
  const LINES: readonly RecordResult[] = [
    ok(buildAssistantRecord({ messageId: 'msg_1' })),
    ok(buildAssistantToolUseRecord({ toolUseId: 'toolu_1', toolName: 'Edit' })),
    err({ reason: 'invalid-json' }),
    ok(
      buildUserToolResultRecord({
        toolUseId: 'toolu_1',
        toolUseResult: buildEditToolUseResult('/a.ts'),
        isError: true
      })
    ),
    ok(buildAssistantToolUseRecord({ toolUseId: 'toolu_b', toolName: 'Bash' })),
    ok(
      buildUserToolResultRecord({
        toolUseId: 'toolu_b',
        toolUseResult: buildBashToolUseResult({ unavailable: true })
      })
    ),
    ok(buildAssistantRecord({ messageId: 'msg_2' }))
  ]

  function foldOf(lines: readonly RecordResult[]): ReturnType<typeof createAgentReportsFold> {
    const fold = createAgentReportsFold(leadIdentity)
    for (const line of lines) fold.observe(line)
    return fold
  }

  it('gives the same reports when read between lines as when read at the end', () => {
    const undisturbed = foldOf(LINES)
    const disturbed = createAgentReportsFold(leadIdentity)
    for (const line of LINES) {
      disturbed.observe(line)
      disturbed.snapshot()
    }

    expect(disturbed.snapshot()).toEqual(undisturbed.snapshot())
  })

  it('leaves a snapshot unchanged by the lines observed after it', () => {
    const fold = foldOf(LINES.slice(0, 4))
    const snapshot = fold.snapshot()
    const before = structuredClone(snapshot)

    for (const line of LINES.slice(4)) fold.observe(line)

    expect(snapshot).toEqual(before)
  })

  it('reports every part of a snapshot that a later line would have changed', () => {
    const fold = foldOf(LINES.slice(0, 4))
    const earlier = fold.snapshot()

    for (const line of LINES.slice(4)) fold.observe(line)
    const later = fold.snapshot()

    expect({
      reports: [earlier.reports.length, later.reports.length],
      incomplete: [earlier.incompleteToolUseIds.length, later.incompleteToolUseIds.length],
      signals: [earlier.signalEvents.length, later.signalEvents.length]
    }).toEqual({ reports: [2, 4], incomplete: [0, 1], signals: [2, 4] })
  })

  it('weighs its message reports, file touches and signal events together', () => {
    const fold = foldOf([ok(buildAssistantRecord({ messageId: 'msg_1', model: 'm' }))])

    expect(fold.weight()).toBeGreaterThanOrEqual(MESSAGE_REPORT_OVERHEAD + 'msg_1'.length + 1)
  })

  it('grows as lines are observed', () => {
    const fold = createAgentReportsFold(leadIdentity)
    const weights = [fold.weight()]
    for (const line of [LINES[0], LINES[1], LINES[3]]) {
      fold.observe(line as RecordResult)
      weights.push(fold.weight())
    }

    expect(
      weights.every((weight, index) => index === 0 || weight > (weights[index - 1] ?? 0))
    ).toBe(true)
  })
})
