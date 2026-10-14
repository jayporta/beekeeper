import { FAMILIES, modelFamily, type ModelFamily } from './modelFamily'
import type { DailyUsageDay } from '../../../../../shared/overview/sumDailyUsage'

/** What a series stands for: a model family. */
export type SeriesKey = ModelFamily

/** One series of the chart: a model family. */
export interface Series {
  /** The family the series stands for. */
  readonly key: SeriesKey
  /** The series' tokens over the window. */
  readonly total: number
}

/**
 * Picks the chart's series: one per model family with tokens over the window,
 * in the fixed order of {@link FAMILIES} so a family keeps its place and color.
 *
 * @param days - The days of the window.
 * @returns The series, in family order.
 */
export function seriesOf(days: readonly DailyUsageDay[]): readonly Series[] {
  const totals = new Map<ModelFamily, number>()
  for (const day of days) {
    for (const [model, tokens] of day.byModel) {
      const family = modelFamily(model)
      totals.set(family, (totals.get(family) ?? 0) + tokens)
    }
  }
  return FAMILIES.flatMap((key) => {
    const total = totals.get(key) ?? 0
    return total > 0 ? [{ key, total }] : []
  })
}

/** Options for {@link seriesTokens}. */
export interface SeriesTokensOptions {
  /** The day. */
  readonly day: DailyUsageDay
  /** The series to read. */
  readonly series: Series
}

/**
 * A day's tokens for one series: the sum of the day's models in its family.
 *
 * @param options - The day and the series.
 * @returns The series' tokens that day.
 */
export function seriesTokens(options: SeriesTokensOptions): number {
  const { day, series } = options
  let sum = 0
  for (const [model, tokens] of day.byModel) if (modelFamily(model) === series.key) sum += tokens
  return sum
}
