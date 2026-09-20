import { describe, expect, it } from 'vitest'
import { recordTimestampMs } from '../recordTimestampMs'

describe('recordTimestampMs', () => {
  it('reads a top-level timestamp as epoch milliseconds', () => {
    expect(recordTimestampMs({ timestamp: '2026-01-01T00:00:00.000Z' })).toBe(
      Date.parse('2026-01-01T00:00:00.000Z')
    )
  })

  it('returns null for a record with no timestamp', () => {
    expect(recordTimestampMs({ type: 'ai-title' })).toBeNull()
  })

  it('returns null for a timestamp that is not a parseable date', () => {
    expect(recordTimestampMs({ timestamp: 'not a date' })).toBeNull()
  })

  it('returns null for a timestamp that is not a string', () => {
    expect(recordTimestampMs({ timestamp: 1767225600000 })).toBeNull()
  })
})
