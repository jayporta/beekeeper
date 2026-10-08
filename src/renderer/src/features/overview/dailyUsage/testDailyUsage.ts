import type {
  ProjectDailyUsageDto,
  ProjectDailyUsagePartialDto
} from '../../../../../shared/ipc/projectDailyUsageDto'
import { sumDailyUsage, type DailyUsageSummary } from './sumDailyUsage'

/** A folder's partial counts, all zero unless overridden. */
export function testPartial(
  overrides: Partial<ProjectDailyUsagePartialDto> = {}
): ProjectDailyUsagePartialDto {
  return { unreadable: 0, skippedLines: 0, undated: 0, unreadableSubagents: 0, ...overrides }
}

/**
 * The day keys of a window, oldest first, ending on `lastDay`, stepped back
 * as UTC dates.
 *
 * @param count - How many days.
 * @param lastDay - The last day, `YYYY-MM-DD`.
 * @returns The day keys.
 */
export function dayKeys(count: number, lastDay: string): string[] {
  const [year = NaN, month = NaN, day = NaN] = lastDay.split('-').map(Number)
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(year, month - 1, day - (count - 1 - i))).toISOString().slice(0, 10)
  )
}

/**
 * A folder's usage, with the tokens of each model per day.
 *
 * @param days - Every day of the window, oldest first, with the tokens by model on it. A day with no entry uses nothing.
 * @param partial - Overrides for the partial counts.
 * @returns The usage.
 */
export function testDailyUsage(
  days: Readonly<Record<string, Readonly<Record<string, number>>>>,
  partial: Partial<ProjectDailyUsagePartialDto> = {}
): ProjectDailyUsageDto {
  return {
    days: Object.entries(days).map(([day, models]) => ({
      day,
      models: Object.entries(models)
        .map(([model, tokens]) => ({ model, tokens }))
        .sort((a, b) => b.tokens - a.tokens)
    })),
    partial: testPartial(partial)
  }
}

/**
 * A folder's usage as the summed days of a window, as the chart and table take them.
 *
 * @param days - Every day of the window, oldest first, with the tokens by model on it.
 * @param overrides - Overrides for the summary's other fields.
 * @returns The summary.
 */
export function testSummary(
  days: Readonly<Record<string, Readonly<Record<string, number>>>>,
  overrides: Partial<DailyUsageSummary> = {}
): DailyUsageSummary {
  const summary = sumDailyUsage(
    [{ status: 'ready', usage: testDailyUsage(days), refreshing: false, otherWindow: false }],
    Object.keys(days).length
  )
  return { ...summary, ...overrides }
}

/**
 * A week of usage ending on Wednesday October 7, 2026: 41.2M tokens in all,
 * the most (9.8M) on the last day, from two models.
 */
export const OCTOBER_WEEK: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  '2026-10-01': { 'claude-opus-5': 3_000_000, 'claude-haiku-5': 1_000_000 },
  '2026-10-02': { 'claude-opus-5': 7_000_000 },
  '2026-10-03': { 'claude-haiku-5': 1_200_000 },
  '2026-10-04': { 'claude-opus-5': 2_000_000 },
  '2026-10-05': { 'claude-opus-5': 6_200_000, 'claude-haiku-5': 2_000_000 },
  '2026-10-06': { 'claude-opus-5': 9_000_000 },
  '2026-10-07': { 'claude-opus-5': 6_000_000, 'claude-haiku-5': 3_800_000 }
}
