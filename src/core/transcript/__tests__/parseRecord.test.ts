import { describe, expect, it } from 'vitest'
import { parseRecord } from '../parseRecord'
import { buildAiTitleRecord, toJsonlLine } from '../testFixtures'

describe('parseRecord', () => {
  it('returns the parsed value for valid JSON', () => {
    const record = buildAiTitleRecord('Fix the bug')

    const result = parseRecord(toJsonlLine(record))

    expect(result).toEqual({ ok: true, value: record })
  })

  it('returns a failed result for malformed JSON', () => {
    const result = parseRecord('{"type": "assistant", "message": }')

    expect(result.ok).toBe(false)
  })

  it('never includes the line content in the error', () => {
    const secretLine = '{"broken": "line with a super-secret-token-value }'
    const result = parseRecord(secretLine)

    expect(JSON.stringify(result)).not.toContain('super-secret-token-value')
  })
})
