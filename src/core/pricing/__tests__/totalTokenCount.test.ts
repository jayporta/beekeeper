import { describe, expect, it } from 'vitest'
import { emptyTokenCounts } from '../tokenCounts'
import { totalTokenCount } from '../totalTokenCount'

describe('totalTokenCount', () => {
  it('sums every billing class', () => {
    const counts = { input: 1, output: 2, cacheRead: 4, cacheWrite5m: 8, cacheWrite1h: 16 }

    expect(totalTokenCount(counts)).toBe(31)
  })

  it('is zero for empty counts', () => {
    expect(totalTokenCount(emptyTokenCounts)).toBe(0)
  })

  it('returns a non-finite sum as-is', () => {
    expect(totalTokenCount({ ...emptyTokenCounts, input: Infinity })).toBe(Infinity)
  })
})
