import type { TotalsWindowDto } from '../../shared/ipc/projectTotalsDto'
import type { DayKey } from '../../core/usage/dailyUsage'
import { DAY_MS, TOTALS_WINDOW_MS } from './totalsWindow'

/** Options for {@link windowDays}. */
export interface WindowDaysOptions {
  /** The local day the window ends on, `YYYY-MM-DD`. */
  readonly todayKey: DayKey
  /** How far back the window reaches. */
  readonly window: TotalsWindowDto
}

/**
 * Lists the calendar days of a window, ending today. The day keys are stepped
 * back as UTC dates, so a daylight saving change in the local zone can't skip
 * or repeat a day.
 *
 * @param options - The day the window ends on and its length.
 * @returns 7 or 30 day keys, oldest first.
 * @throws {RangeError} When `todayKey` is not a valid date.
 */
export function windowDays(options: WindowDaysOptions): DayKey[] {
  const { todayKey, window } = options
  const count = TOTALS_WINDOW_MS[window] / DAY_MS
  const [year = NaN, month = NaN, day = NaN] = todayKey.split('-').map(Number)
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(year, month - 1, day - (count - 1 - i))).toISOString().slice(0, 10)
  )
}
