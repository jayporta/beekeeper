import { describe, expect, it } from 'vitest'
import { activitySpanMs } from '../activitySpanMs'

describe('activitySpanMs', () => {
  it('is null without activity', () => {
    expect(activitySpanMs(null)).toBeNull()
  })

  it('is the time from the earliest to the latest timestamp', () => {
    expect(activitySpanMs({ earliestMs: 1000, latestMs: 4500 })).toBe(3500)
  })
})
