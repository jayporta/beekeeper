import { describe, expect, it } from 'vitest'
import { sumDailyUsage, type FolderDailyUsageState } from '../sumDailyUsage'
import { testDailyUsage } from '../testDailyUsage'

const ready = (...args: Parameters<typeof testDailyUsage>): FolderDailyUsageState => ({
  status: 'ready',
  usage: testDailyUsage(...args),
  refreshing: false
})
const refreshingReady = (): FolderDailyUsageState => ({
  status: 'ready',
  usage: testDailyUsage({ '2026-03-10': { a: 1 } }),
  refreshing: true
})
const LOADING: FolderDailyUsageState = { status: 'loading' }
const FAILED: FolderDailyUsageState = { status: 'error' }

describe('sumDailyUsage', () => {
  it('merges folders by day and model', () => {
    const summary = sumDailyUsage(
      [
        ready({ '2026-03-09': { a: 5, b: 1 }, '2026-03-10': { a: 2 } }),
        ready({ '2026-03-09': { a: 3 }, '2026-03-10': { b: 4 } })
      ],
      2
    )

    expect(summary.days.map((d) => [d.day, [...d.byModel], d.total])).toEqual([
      [
        '2026-03-09',
        [
          ['a', 8],
          ['b', 1]
        ],
        9
      ],
      [
        '2026-03-10',
        [
          ['a', 2],
          ['b', 4]
        ],
        6
      ]
    ])
    expect(summary.total).toBe(15)
  })

  it('ends on the latest day any folder returned and drops the days before the window', () => {
    const summary = sumDailyUsage(
      [
        ready({ '2026-03-08': { a: 100 }, '2026-03-09': { a: 1 }, '2026-03-10': { a: 2 } }),
        ready({ '2026-03-07': { a: 1000 }, '2026-03-08': { a: 10 }, '2026-03-09': { a: 4 } })
      ],
      3
    )

    expect(summary.days.map((d) => [d.day, d.total])).toEqual([
      ['2026-03-08', 110],
      ['2026-03-09', 5],
      ['2026-03-10', 2]
    ])
    expect(summary.total).toBe(117)
  })

  it('lists a quiet day with no models and a zero total', () => {
    const summary = sumDailyUsage([ready({ '2026-03-09': {}, '2026-03-10': { a: 1 } })], 2)

    expect(summary.days[0]).toMatchObject({ day: '2026-03-09', total: 0 })
    expect(summary.days[0]?.byModel.size).toBe(0)
  })

  it('counts folders still loading and folders that failed, and sums only the ready ones', () => {
    const summary = sumDailyUsage([ready({ '2026-03-10': { a: 3 } }), LOADING, LOADING, FAILED], 1)

    expect(summary).toMatchObject({ total: 3, loading: 2, failed: 1 })
  })

  it('sums the partial counts of the ready folders', () => {
    const summary = sumDailyUsage(
      [
        ready({ '2026-03-10': {} }, { unreadable: 1, skippedLines: 2 }),
        ready({ '2026-03-10': {} }, { skippedLines: 1, undated: 4, unreadableSubagents: 3 }),
        FAILED
      ],
      1
    )

    expect(summary.partial).toEqual({
      unreadable: 1,
      skippedLines: 3,
      undated: 4,
      unreadableSubagents: 3
    })
  })

  it('is refreshing when any ready folder shows the previous window’s figures', () => {
    expect(sumDailyUsage([ready({ '2026-03-10': {} }), refreshingReady()], 1).refreshing).toBe(true)
  })

  it('is not refreshing when no ready folder is, whatever else is loading or failed', () => {
    const summary = sumDailyUsage([ready({ '2026-03-10': {} }), LOADING, FAILED], 1)

    expect(summary.refreshing).toBe(false)
  })

  it('has no days when no folder is ready', () => {
    const summary = sumDailyUsage([LOADING, FAILED], 7)

    expect(summary).toMatchObject({ days: [], total: 0, loading: 1, failed: 1 })
  })

  it('has no days for no folders', () => {
    expect(sumDailyUsage([], 7)).toMatchObject({ days: [], total: 0, loading: 0, failed: 0 })
  })
})
