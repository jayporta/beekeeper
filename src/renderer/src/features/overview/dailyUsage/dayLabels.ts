import type { TFunction } from 'i18next'
import { dayKeyDate } from './dayKeyDate'

/** A day's text in each form the chart and table use. */
export interface DayLabels {
  /** The short weekday, such as `Wed`. */
  readonly weekday: string
  /** The short month and day, such as `Oct 7`. */
  readonly date: string
  /** Both, such as `Wed, Oct 7`. */
  readonly full: string
}

/**
 * Formats a day key for display, in the active language.
 *
 * @param t - The overview namespace's translate function.
 * @param day - A local calendar day, `YYYY-MM-DD`.
 * @returns The day's weekday, date, and both together.
 */
export function dayLabels(t: TFunction<'overview'>, day: string): DayLabels {
  const value = dayKeyDate(day)
  const weekday = t('dailyUsage.dayShort', { value })
  const date = t('dailyUsage.dayDate', { value })
  return { weekday, date, full: t('dailyUsage.dayFull', { weekday, date }) }
}
