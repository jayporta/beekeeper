import type { ModelFamily } from './modelFamily'
import type { Series } from './seriesOf'

/** One model family's share of the window's tokens. */
export interface ModelShare {
  /** The family. */
  readonly key: ModelFamily
  /** The family's tokens over the window. */
  readonly tokens: number
  /** The family's share of the total, from `0` to `1`: `0` when the total is zero. */
  readonly fraction: number
  /** The share as a whole percent, rounded. */
  readonly percent: number
  /** Whether the family has tokens but rounds to zero percent, so it reads "<1%". */
  readonly underOne: boolean
}

/**
 * Each family's share of the window's tokens, in the series order.
 *
 * @param series - The chart's series, from `seriesOf`.
 * @param total - The tokens over every day, from the summary.
 * @returns A row per series. Every share is zero, never NaN, when the total is zero.
 */
export function byModelTotals(series: readonly Series[], total: number): readonly ModelShare[] {
  return series.map(({ key, total: tokens }) => {
    const fraction = total > 0 ? tokens / total : 0
    const percent = Math.round(fraction * 100)
    return { key, tokens, fraction, percent, underOne: tokens > 0 && percent === 0 }
  })
}
