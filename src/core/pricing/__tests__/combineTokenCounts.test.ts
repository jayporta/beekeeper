import { describe, expect, it } from 'vitest'
import { combineTokenCounts, emptyTokenCounts, type TokenCounts } from '../tokenCounts'

const a: TokenCounts = { input: 10, output: 1, cacheRead: 7, cacheWrite5m: 3, cacheWrite1h: 9 }
const b: TokenCounts = { input: 2, output: 20, cacheRead: 7, cacheWrite5m: 30, cacheWrite1h: 0 }

describe('combineTokenCounts', () => {
  it('sums every billing class independently', () => {
    expect(combineTokenCounts([a, b], (x, y) => x + y)).toEqual({
      input: 12,
      output: 21,
      cacheRead: 14,
      cacheWrite5m: 33,
      cacheWrite1h: 9
    })
  })

  it('takes the per-class max', () => {
    expect(combineTokenCounts([a, b], Math.max)).toEqual({
      input: 10,
      output: 20,
      cacheRead: 7,
      cacheWrite5m: 30,
      cacheWrite1h: 9
    })
  })

  it('does not mutate either input', () => {
    const aBefore = { ...a }
    const bBefore = { ...b }

    combineTokenCounts([a, b], Math.max)

    expect(a).toEqual(aBefore)
    expect(b).toEqual(bBefore)
  })

  it('returns the identity value when combined with an empty count', () => {
    expect(combineTokenCounts([a, emptyTokenCounts], (x, y) => x + y)).toEqual(a)
  })
})
