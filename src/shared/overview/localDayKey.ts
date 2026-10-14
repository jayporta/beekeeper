/**
 * The local calendar day of an instant, in the renderer's time zone.
 *
 * @param epochMs - The instant, in milliseconds since the Unix epoch.
 * @returns The day as `YYYY-MM-DD`.
 */
export function localDayKey(epochMs: number): string {
  const date = new Date(epochMs)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
