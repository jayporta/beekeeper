import { describe, expect, it } from 'vitest'
import { shareOfLargest } from '../shareOfLargest'

describe('shareOfLargest', () => {
  it('is the fraction of the largest figure', () => {
    expect(shareOfLargest(25, 100)).toBe(0.25)
  })

  it('is 1 for the largest figure itself', () => {
    expect(shareOfLargest(100, 100)).toBe(1)
  })

  it('is 0 when every figure is 0, rather than dividing by zero', () => {
    expect(shareOfLargest(0, 0)).toBe(0)
  })

  it('never exceeds 1', () => {
    expect(shareOfLargest(150, 100)).toBe(1)
  })
})
