const FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Formats a last-active time for the table, in the viewer's time zone.
 *
 * @param ms - Milliseconds since the Unix epoch, or `null` when unknown.
 * @returns For example `Jan 15, 2026, 12:00 PM`, or `null` when `ms` is `null`.
 */
export function formatLastActive(ms: number | null): string | null {
  return ms === null ? null : FORMAT.format(ms)
}
