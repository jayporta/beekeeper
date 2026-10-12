/** What {@link lastActivityMs} compares. */
export interface ActivityTimes {
  /** The latest message timestamp in epoch milliseconds, or `null` when no message has one. */
  readonly activityLatestMs: number | null
  /** The transcript's last-modified time in epoch milliseconds, or `null` when it is unknown. */
  readonly modifiedMs: number | null
}

/**
 * Finds when a session was last active: the later of its latest message and
 * its transcript's modification time.
 *
 * @param times - The two times, each possibly unknown.
 * @returns The later time in epoch milliseconds, or `null` when both are unknown.
 */
export function lastActivityMs(times: ActivityTimes): number | null {
  const { activityLatestMs, modifiedMs } = times
  if (activityLatestMs === null) return modifiedMs
  if (modifiedMs === null) return activityLatestMs
  return Math.max(activityLatestMs, modifiedMs)
}
