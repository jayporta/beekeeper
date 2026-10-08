/**
 * Local noon of a day key, for formatting it as a date. Noon keeps the
 * formatted day right whichever way a daylight saving change shifts midnight.
 *
 * @param day - A local calendar day, `YYYY-MM-DD`.
 * @returns Local noon of that day, in milliseconds since the Unix epoch.
 */
export function dayKeyDate(day: string): number {
  const [year = NaN, month = NaN, date = NaN] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12).getTime()
}
