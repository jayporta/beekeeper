import { describe, expect, it } from 'vitest'
import { dailyUsageStatusOf } from '../dailyUsageStatus'
import { testPartial, testSummary } from '../testDailyUsage'

const withDays = (
  overrides: Parameters<typeof testSummary>[1] = {}
): ReturnType<typeof testSummary> => testSummary({ '2026-03-10': { a: 1 } }, overrides)
const noDays = (
  overrides: Parameters<typeof testSummary>[1] = {}
): ReturnType<typeof testSummary> => ({ ...testSummary({}), ...overrides })

describe('dailyUsageStatusOf', () => {
  it('is settled and updated for complete usage', () => {
    expect(dailyUsageStatusOf(withDays())).toEqual({ settled: true, outcome: 'updated' })
  })

  it('is settled and partial when a reason applies', () => {
    const summary = withDays({ partial: testPartial({ skippedLines: 1 }) })

    expect(dailyUsageStatusOf(summary)).toEqual({ settled: true, outcome: 'partial' })
  })

  it('is partial, not failed, when some folders failed and others have usage', () => {
    expect(dailyUsageStatusOf(withDays({ failed: 1 })).outcome).toBe('partial')
  })

  it('is not settled while a folder is still loading', () => {
    expect(dailyUsageStatusOf(withDays({ loading: 1 })).settled).toBe(false)
  })

  it('is not settled while the figures are the other window’s', () => {
    expect(dailyUsageStatusOf(withDays({ refreshing: true, awaitingWindow: true })).settled).toBe(
      false
    )
  })

  it('is settled while only the next day’s figures are on their way, since the window did not change', () => {
    expect(dailyUsageStatusOf(withDays({ refreshing: true, awaitingWindow: false })).settled).toBe(
      true
    )
  })

  it('is not settled before any folder is listed, with nothing to show', () => {
    expect(dailyUsageStatusOf(noDays()).settled).toBe(false)
  })

  it('is settled and failed when every folder failed', () => {
    expect(dailyUsageStatusOf(noDays({ failed: 2 }))).toEqual({ settled: true, outcome: 'failed' })
  })

  it('is not settled when some folders failed and the rest are still loading', () => {
    expect(dailyUsageStatusOf(noDays({ failed: 1, loading: 1 })).settled).toBe(false)
  })
})
