import { describe, expect, it } from 'vitest'
import { dailyUsageReasonsOf } from '../dailyUsageReasons'
import type { DailyUsageSummary } from '../sumDailyUsage'
import { testPartial, testSummary } from '../testDailyUsage'

const summary = (overrides: Parameters<typeof testSummary>[1]): DailyUsageSummary =>
  testSummary({ '2026-03-10': {} }, overrides)

describe('dailyUsageReasonsOf', () => {
  it('is empty for a complete summary', () => {
    expect(dailyUsageReasonsOf(summary({}))).toEqual([])
  })

  it.each([
    ['loading', { loading: 1 }],
    ['failed', { failed: 1 }],
    ['unreadable', { partial: testPartial({ unreadable: 1 }) }],
    ['skippedLines', { partial: testPartial({ skippedLines: 1 }) }],
    ['undated', { partial: testPartial({ undated: 1 }) }],
    ['unreadableSubagents', { partial: testPartial({ unreadableSubagents: 1 }) }]
  ] as const)('names %s when only it applies', (reason, overrides) => {
    expect(dailyUsageReasonsOf(summary(overrides))).toEqual([reason])
  })

  it('lists every reason that applies, in the footnote’s order', () => {
    const everything = summary({
      loading: 1,
      failed: 1,
      partial: { unreadable: 1, skippedLines: 1, undated: 1, unreadableSubagents: 1 }
    })

    expect(dailyUsageReasonsOf(everything)).toEqual([
      'loading',
      'failed',
      'unreadable',
      'skippedLines',
      'undated',
      'unreadableSubagents'
    ])
  })
})
