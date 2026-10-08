import type { DailyUsageSummary } from './sumDailyUsage'

/** Why a day's total may be low. The order of the list is the order the footnote gives them in. */
export const DAILY_USAGE_REASONS = [
  'loading',
  'failed',
  'unreadable',
  'skippedLines',
  'undated',
  'unreadableSubagents'
] as const

/** One reason a day's total may be low. */
export type DailyUsageReason = (typeof DAILY_USAGE_REASONS)[number]

/**
 * Names why a summary may be low.
 *
 * @param summary - The summed daily usage.
 * @returns The reasons that apply, in footnote order. Empty when the summary is complete.
 */
export function dailyUsageReasonsOf(summary: DailyUsageSummary): readonly DailyUsageReason[] {
  const { partial } = summary
  const applies: Readonly<Record<DailyUsageReason, boolean>> = {
    loading: summary.loading > 0,
    failed: summary.failed > 0,
    unreadable: partial.unreadable > 0,
    skippedLines: partial.skippedLines > 0,
    undated: partial.undated > 0,
    unreadableSubagents: partial.unreadableSubagents > 0
  }
  return DAILY_USAGE_REASONS.filter((reason) => applies[reason])
}
