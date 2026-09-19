import { describe, expect, it } from 'vitest'
import { parseRecord } from '../parseRecord'

describe('parseRecord', () => {
  it('returns the parsed value for valid JSON', () => {
    const result = parseRecord('{"type":"ai-title","title":"Fix the bug"}')

    expect(result).toEqual({ ok: true, value: { type: 'ai-title', title: 'Fix the bug' } })
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
