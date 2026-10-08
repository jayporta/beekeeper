import type {
  ProjectDailyUsageDto,
  ProjectDailyUsagePartialDto
} from '../../../../../shared/ipc/projectDailyUsageDto'

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
