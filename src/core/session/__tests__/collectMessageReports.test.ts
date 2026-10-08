import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from '../../shared/result'
import type { SkippedLineError } from '../../transcript/readRecords'
import { buildAssistantRecord } from '../../transcript/testFixtures'
import { subagentIdentity } from '../agentIdentity'
import { collectMessageReports } from '../collectMessageReports'
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
