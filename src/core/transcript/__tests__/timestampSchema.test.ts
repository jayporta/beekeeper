import { describe, expect, it } from 'vitest'
import { timestampSchema } from '../schemas/timestamp'

describe('timestampSchema', () => {
  it('accepts a parseable ISO timestamp', () => {
    expect(timestampSchema.parse('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z')
  })

  it('treats a missing timestamp as absent', () => {
    expect(timestampSchema.parse(undefined)).toBeUndefined()
  })

  it('treats an unparseable value as absent rather than failing', () => {
    expect(timestampSchema.parse('not-a-date')).toBeUndefined()
  })
})
