import type { SessionsT } from './sessionsT'

const MS_PER_MINUTE = 60_000

/**
 * Formats a length of time.
 *
 * @param ms - The length in milliseconds, or `null` when unknown. A negative length counts as zero.
 * @param t - The sessions translate function, which supplies the unit pattern.
 * @returns `<1m`, `42m`, `3h`, or `3h 5m`, or `null` when `ms` is `null`.
 */
export function formatDuration(ms: number | null, t: SessionsT): string | null {
  if (ms === null) return null

  const minutes = Math.floor(Math.max(0, ms) / MS_PER_MINUTE)
  if (minutes < 1) return t('duration.underMinute', { minutes: 1 })
  if (minutes < 60) return t('duration.minutes', { minutes })

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? t('duration.hours', { hours })
    : t('duration.hoursMinutes', { hours, minutes: rest })
}
