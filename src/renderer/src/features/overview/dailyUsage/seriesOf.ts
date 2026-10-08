import type { DailyUsageDay } from './sumDailyUsage'

/** The most models drawn as their own series; the rest fold into one other series. */
export const MAX_SERIES = 4

/** What a series stands for. */
export type SeriesKey =
  | {
      /** One model. */
      readonly kind: 'model'
      /** The normalized model id. Transcript-derived: render as plain text. */
      readonly model: string
    }
  | {
      /** Every model beyond the top {@link MAX_SERIES}. */
      readonly kind: 'other'
    }

/** One series of the chart: a model, or the rest together. */
export interface Series {
  /** What the series stands for. */
  readonly key: SeriesKey
  /** `0` to `MAX_SERIES - 1` for a model, `MAX_SERIES` for the other series: picks its color. */
  readonly index: number
  /** The series' tokens over the window. */
  readonly total: number
}

/**
 * Picks the chart's series: the top {@link MAX_SERIES} models by tokens over
 * the window, largest first with ties by model id, then one other series only
 * when more models exist.
 *
 * @param days - The days of the window.
 * @returns The series, models first, then other when there is one.
 */
export function seriesOf(days: readonly DailyUsageDay[]): readonly Series[] {
  const totals = new Map<string, number>()
  for (const day of days) {
    for (const [model, tokens] of day.byModel) totals.set(model, (totals.get(model) ?? 0) + tokens)
  }

  const ranked = [...totals].sort(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0))
  const models = ranked
    .slice(0, MAX_SERIES)
    .map(([model, total], index): Series => ({ key: { kind: 'model', model }, index, total }))
  const rest = ranked.slice(MAX_SERIES).reduce((sum, [, total]) => sum + total, 0)
  return ranked.length > MAX_SERIES
    ? [...models, { key: { kind: 'other' }, index: MAX_SERIES, total: rest }]
    : models
}

/** Options for {@link seriesTokens}. */
export interface SeriesTokensOptions {
  /** The day. */
  readonly day: DailyUsageDay
  /** The series to read. */
  readonly series: Series
  /** Every series of the chart, from {@link seriesOf}. */
  readonly all: readonly Series[]
}

/**
 * A day's tokens for one series. The other series holds what the model
 * series leave of the day.
 *
 * @param options - The day, the series, and all series.
 * @returns The series' tokens that day.
 */
export function seriesTokens(options: SeriesTokensOptions): number {
  const { day, series, all } = options
  if (series.key.kind === 'model') return day.byModel.get(series.key.model) ?? 0
  return all.reduce(
    (rest, other) =>
      other.key.kind === 'model' ? rest - (day.byModel.get(other.key.model) ?? 0) : rest,
    day.total
  )
}
