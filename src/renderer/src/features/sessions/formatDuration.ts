import type { SessionsT } from './sessionsT'

const MS_PER_MINUTE = 60_000

/**
 * Formats how long a session's records span.
 *
 * @param activity - The span of its timestamps, or `null` when it has none.
 * @param t - The sessions translate function, which supplies the unit pattern.
 * @returns `<1m`, `42m`, `3h`, or `3h 5m`, or `null` when `activity` is `null`.
 */
export function formatDuration(
  activity: { readonly earliestMs: number; readonly latestMs: number } | null,
  t: SessionsT
): string | null {
  if (activity === null) return null

  const minutes = Math.floor(Math.max(0, activity.latestMs - activity.earliestMs) / MS_PER_MINUTE)
  if (minutes < 1) return t('duration.underMinute', { minutes: 1 })
  if (minutes < 60) return t('duration.minutes', { minutes })

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? t('duration.hours', { hours })
    : t('duration.hoursMinutes', { hours, minutes: rest })
}
