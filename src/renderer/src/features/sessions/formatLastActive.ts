import type { SessionsT } from './sessionsT'

/**
 * Formats a last-active time for a session card, in the viewer's time zone and the
 * active language.
 *
 * @param ms - Milliseconds since the Unix epoch, or `null` when unknown.
 * @param t - The sessions translate function, which supplies the date format.
 * @returns For example `Jan 15, 2026, 12:00 PM`, or `null` when `ms` is `null`.
 */
export function formatLastActive(ms: number | null, t: SessionsT): string | null {
  return ms === null ? null : t('lastActive', { value: ms })
}
