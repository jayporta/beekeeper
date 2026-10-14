import { describe, expect, it } from 'vitest'
import { chartScale } from '../chartScale'

describe('chartScale', () => {
  it('is just zero for no usage', () => {
    expect(chartScale(0)).toEqual({ top: 0, ticks: [0] })
  })

  it.each([[-5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'is just zero for %s, which is not a usable maximum',
    (max) => {
      expect(chartScale(max)).toEqual({ top: 0, ticks: [0] })
    }
  )

  it('rounds 7 up to 8 with a middle tick at 4', () => {
    expect(chartScale(7)).toEqual({ top: 8, ticks: [0, 4, 8] })
  })

  it('rounds 41.2 million up to 50 million with a middle tick at 25 million', () => {
    expect(chartScale(41_200_000)).toEqual({
      top: 50_000_000,
      ticks: [0, 25_000_000, 50_000_000]
    })
  })

  it('keeps a maximum that is already a tick as the top', () => {
    expect(chartScale(40)).toEqual({ top: 40, ticks: [0, 20, 40] })
  })

  it('never has a top below two tokens, so the middle tick is a whole token', () => {
    expect(chartScale(1)).toEqual({ top: 2, ticks: [0, 1, 2] })
    expect(chartScale(3)).toEqual({ top: 4, ticks: [0, 2, 4] })
  })

  it.each([1, 3, 7, 12, 99, 100, 101, 4_999, 5_000, 41_200_000, 123_456_789_012])(
    'covers %d with a top at or above it, and shows three ticks: zero, a middle, and the top',
    (max) => {
      const { top, ticks } = chartScale(max)

      expect(top).toBeGreaterThanOrEqual(max)
      expect(ticks).toEqual([0, top / 2, top])
    }
  )

  it.each([1, 2, 3, 5, 7, 11, 13, 25, 99, 1_001, 41_200_000])(
    'never puts a fractional middle tick on the axis for %d',
    (max) => {
      expect(Number.isInteger(chartScale(max).ticks[1])).toBe(true)
    }
  )

  it.each([1, 3, 7, 12, 99, 101, 4_999, 41_200_000, 123_456_789_012])(
    'tops out at no more than twice %d',
    (max) => {
      expect(chartScale(max).top).toBeLessThanOrEqual(max * 2)
    }
  )

  it('stays finite for a huge maximum', () => {
    const { top, ticks } = chartScale(Number.MAX_SAFE_INTEGER)

    expect(Number.isFinite(top)).toBe(true)
    expect(top).toBeGreaterThanOrEqual(Number.MAX_SAFE_INTEGER)
    expect(ticks.every(Number.isFinite)).toBe(true)
  })
})
