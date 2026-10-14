import { describe, expect, it } from 'vitest'
import { shareOfTotal } from '../shareOfTotal'

describe('shareOfTotal', () => {
  it('is the rounded percent of the total', () => {
    expect(shareOfTotal(1, 3)).toBe(33)
    expect(shareOfTotal(2, 3)).toBe(67)
  })

  it('is 100 when the figure is the whole', () => {
    expect(shareOfTotal(7, 7)).toBe(100)
  })

  it('is 0, never NaN or Infinity, when the total is zero', () => {
    expect(shareOfTotal(0, 0)).toBe(0)
    expect(shareOfTotal(5, 0)).toBe(0)
  })
})
