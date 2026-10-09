import { ARCHIVE_DETAIL_AFTER_DAYS, DAY_MS } from './archiveConstants'

/**
 * Decides whether a session has been quiet long enough to archive its detail.
 *
 * @param lastActivityMs - When the session was last active, or `null` when unknown.
 * @param nowMs - The current time in epoch milliseconds.
 * @returns `true` when the session's last activity is at least
 * {@link ARCHIVE_DETAIL_AFTER_DAYS} days old. A session with no known activity is never due.
 */
export function isDetailDue(lastActivityMs: number | null, nowMs: number): boolean {
  return lastActivityMs !== null && nowMs - lastActivityMs >= ARCHIVE_DETAIL_AFTER_DAYS * DAY_MS
}
