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

  it('rounds 7 up to 8 in steps of 2', () => {
    expect(chartScale(7)).toEqual({ top: 8, ticks: [0, 2, 4, 6, 8] })
  })

  it('rounds 41.2 million up to 50 million in steps of 10 million', () => {
    expect(chartScale(41_200_000)).toEqual({
      top: 50_000_000,
      ticks: [0, 10_000_000, 20_000_000, 30_000_000, 40_000_000, 50_000_000]
    })
  })

  it('keeps a maximum that is already a tick as the top', () => {
    expect(chartScale(40)).toEqual({ top: 40, ticks: [0, 10, 20, 30, 40] })
  })

  it('never uses a step below one token', () => {
    expect(chartScale(1)).toEqual({ top: 1, ticks: [0, 1] })
    expect(chartScale(3)).toEqual({ top: 3, ticks: [0, 1, 2, 3] })
  })

  it.each([1, 3, 7, 12, 99, 100, 101, 4_999, 5_000, 41_200_000, 123_456_789_012])(
    'covers %d with a top at or above it and between two and five ticks above zero',
    (max) => {
      const { top, ticks } = chartScale(max)

      expect(top).toBeGreaterThanOrEqual(max)
      expect(ticks.at(-1)).toBe(top)
      expect(ticks.length - 1).toBeGreaterThanOrEqual(1)
      expect(ticks.length - 1).toBeLessThanOrEqual(5)
    }
  )

  it('stays finite for a huge maximum', () => {
    const { top, ticks } = chartScale(Number.MAX_SAFE_INTEGER)

    expect(Number.isFinite(top)).toBe(true)
    expect(top).toBeGreaterThanOrEqual(Number.MAX_SAFE_INTEGER)
    expect(ticks.every(Number.isFinite)).toBe(true)
  })
})
