import { dailyUsageReasonsOf } from './dailyUsageReasons'
import type { DailyUsageSummary } from './sumDailyUsage'

/** What the window's daily usage came to once it settled: figures, figures that may be low, or nothing that could be loaded. */
export type DailyUsageOutcome = 'updated' | 'partial' | 'failed'

/** Where the window's daily usage stands. */
export interface DailyUsageStatus {
  /** Whether every folder has answered, with no figures standing in from a previous window or day, and there is something to say: usage, or that none could be loaded. */
  readonly settled: boolean
  /** What the usage came to. It is only final once `settled`. */
  readonly outcome: DailyUsageOutcome
}

/**
 * Reads where a summary of daily usage stands, for the section's busy state
 * and the overview's announcement.
 *
 * @param summary - The summed daily usage.
 * @returns Whether it has settled, and what it came to.
 */
export function dailyUsageStatusOf(summary: DailyUsageSummary): DailyUsageStatus {
  const hasDays = summary.days.length > 0
  const failedOutright = !hasDays && summary.failed > 0 && summary.loading === 0
  const settled = summary.loading === 0 && !summary.refreshing && (hasDays || failedOutright)
  if (failedOutright) return { settled, outcome: 'failed' }
  return { settled, outcome: dailyUsageReasonsOf(summary).length > 0 ? 'partial' : 'updated' }
}
