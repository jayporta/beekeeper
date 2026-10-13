import type { TFunction } from 'i18next'
import type { SeriesKey } from './seriesOf'

/**
 * The translated name of a series' family.
 *
 * @param series - The series.
 * @param t - The `overview` namespace's translate function.
 * @returns The family's display name.
 */
export function seriesLabel(series: { readonly key: SeriesKey }, t: TFunction<'overview'>): string {
  return t(`dailyUsage.family.${series.key}`)
}
