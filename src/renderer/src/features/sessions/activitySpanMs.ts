/**
 * Measures the wall-clock span of a session's timestamps.
 *
 * @param activity - The earliest and latest timestamps, or `null` when there are none.
 * @returns The milliseconds from the earliest to the latest, or `null` when `activity` is `null`.
 */
export function activitySpanMs(
  activity: { readonly earliestMs: number; readonly latestMs: number } | null
): number | null {
  return activity === null ? null : activity.latestMs - activity.earliestMs
}
