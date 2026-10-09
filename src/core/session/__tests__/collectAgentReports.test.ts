import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from '../../shared/result'
import type { SkippedLineError } from '../../transcript/readRecords'
import {
  buildAssistantToolUseRecord,
  buildBashToolUseResult,
  buildEditToolUseResult,
  buildUserToolResultRecord
} from '../../transcript/testFileTouchFixtures'
import { buildToolResultRecord } from '../../transcript/signals/testSignalFixtures'
import { buildAssistantRecord } from '../../transcript/testFixtures'
import { leadIdentity } from '../agentIdentity'
import { collectAgentReports } from '../collectAgentReports'
import { MAX_BASH_TOUCHES_PER_TRANSCRIPT } from '../fileTouchCollector'

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
      recordsOf(ok(buildToolResultRecord({ toolUseId: 'toolu_1', isError: true }))),
      leadIdentity
    )

    expect(signalEvents).toMatchObject([
      { kind: 'tool-result', toolUseId: 'toolu_1', isError: true }
    ])
    expect(signalsCapped).toBe(false)
  })
})
