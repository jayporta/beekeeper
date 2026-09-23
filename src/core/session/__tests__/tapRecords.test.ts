import { describe, expect, it } from 'vitest'
import type { SkippedLineError } from '../../transcript/readRecords'
import { ok, type Result } from '../../transcript/result'
import { tapRecords } from '../tapRecords'

async function* fromResults(
  results: readonly Result<Record<string, unknown>, SkippedLineError>[]
): AsyncGenerator<Result<Record<string, unknown>, SkippedLineError>> {
  for (const result of results) yield result
}

describe('tapRecords', () => {
  it('yields every result unchanged and observes each valid record', async () => {
    const skipped: Result<Record<string, unknown>, SkippedLineError> = {
      ok: false,
      error: { reason: 'invalid-json' }
    }
    const results = [ok({ type: 'a' }), skipped, ok({ type: 'b' })]
    const seen: unknown[] = []

    const yielded: unknown[] = []
    for await (const result of tapRecords(fromResults(results), (record) => seen.push(record))) {
      yielded.push(result)
    }

    expect(yielded).toEqual(results)
    expect(seen).toEqual([{ type: 'a' }, { type: 'b' }])
  })
})
