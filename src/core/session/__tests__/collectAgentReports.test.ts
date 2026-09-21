import { describe, expect, it } from 'vitest'
import type { SkippedLineError } from '../../transcript/readRecords'
import { err, ok, type Result } from '../../transcript/result'
import { buildAssistantRecord } from '../../transcript/testFixtures'
import { leadIdentity } from '../agentIdentity'
import { collectAgentReports } from '../collectAgentReports'

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
})
