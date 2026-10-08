import { describe, expect, it } from 'vitest'
import { compareDailyUsageBuckets } from '../compareDailyUsageBuckets'
import type { DailyUsageBucket } from '../dailyUsage'

const bucket = (day: string, model: string): DailyUsageBucket => ({ day, model, tokens: 1 })

describe('compareDailyUsageBuckets', () => {
  it('orders by day first', () => {
    const sorted = [bucket('2026-01-02', 'a'), bucket('2026-01-01', 'z')].sort(
      compareDailyUsageBuckets
    )

    expect(sorted.map((b) => b.day)).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('orders by model within a day', () => {
    const sorted = [bucket('2026-01-01', 'b'), bucket('2026-01-01', 'a')].sort(
      compareDailyUsageBuckets
    )

    expect(sorted.map((b) => b.model)).toEqual(['a', 'b'])
  })
})
