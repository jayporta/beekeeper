import type { SessionEntry } from '../../core/transcript/discoverSessions'
import type { TotalsWindowDto } from '../../shared/ipc/projectTotalsDto'

/** One day, in milliseconds. */
export const DAY_MS = 24 * 60 * 60 * 1000

/** How long each totals window is, in milliseconds. */
export const TOTALS_WINDOW_MS: Readonly<Record<TotalsWindowDto, number>> = {
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS
}

/**
 * How much older than a window's start a transcript's file may be and still be
 * read. A session's activity can be later than its file's time, as for a
 * transcript that was copied or restored, or after the clock moved, so only
 * a file older than this has activity that is surely outside the window.
 */
export const SKIP_UNREAD_SLACK_MS = DAY_MS

/**
 * Decides whether a session's transcript is worth reading for a window: not
 * when its file is older than the window's start by more than
 * {@link SKIP_UNREAD_SLACK_MS}, since its activity can't be later than that.
 * A transcript that couldn't be stat'd has no time to judge by and is kept,
 * so it is counted as unreadable.
 *
 * @param entry - The discovered session.
 * @param window - The window's end, in milliseconds since the Unix epoch, and its length.
 * @returns `true` to read it.
 */
export function mayCountInWindow(
  entry: Pick<SessionEntry, 'transcript'>,
  window: { readonly nowMs: number; readonly windowMs: number }
): boolean {
  if (!entry.transcript.ok) return true
  return entry.transcript.value.mtimeMs >= window.nowMs - window.windowMs - SKIP_UNREAD_SLACK_MS
}

/**
 * Decides whether a session may have usage on a window's days: not when its
 * lead and subagent files are all older than the window's length and a day
 * back (the first calendar day can start that early) by more than
 * {@link SKIP_UNREAD_SLACK_MS}. A transcript that couldn't be stat'd is kept,
 * so it is counted as unreadable. Subagent files only count when they were
 * listed.
 *
 * @param entry - The discovered session.
 * @param window - The window's end, in milliseconds since the Unix epoch, and its length.
 * @returns `true` to read it.
 */
export function mayHaveDailyUsage(
  entry: Pick<SessionEntry, 'transcript' | 'subagents'>,
  window: { readonly nowMs: number; readonly windowMs: number }
): boolean {
  if (!entry.transcript.ok) return true
  const subagents = entry.subagents.ok ? entry.subagents.value : []
  const newestMs = subagents.reduce(
    (newest, subagent) => Math.max(newest, subagent.transcript.mtimeMs),
    entry.transcript.value.mtimeMs
  )
  return newestMs >= window.nowMs - window.windowMs - DAY_MS - SKIP_UNREAD_SLACK_MS
}

/**
 * Decides whether an archived session may have usage on a window's days, from
 * the times its list item holds: not when its last message and its transcript's
 * last write are both older than the window's length and a day back (the first
 * calendar day can start that early) by more than {@link SKIP_UNREAD_SLACK_MS}.
 * A session with neither time is kept, so it is counted as unreadable.
 *
 * @param times - When the session's last message was, and when its transcript was last written, either `null` when unknown.
 * @param window - The window's end, in milliseconds since the Unix epoch, and its length.
 * @returns `true` to read its slots.
 */
export function mayArchivedHaveDailyUsage(
  times: { readonly latestMs: number | null; readonly modifiedMs: number | null },
  window: { readonly nowMs: number; readonly windowMs: number }
): boolean {
  const { latestMs, modifiedMs } = times
  if (latestMs === null && modifiedMs === null) return true
  const newestMs = Math.max(latestMs ?? -Infinity, modifiedMs ?? -Infinity)
  return newestMs >= window.nowMs - window.windowMs - DAY_MS - SKIP_UNREAD_SLACK_MS
}

/**
 * Decides whether an archived session may count in a window's totals, from the
 * times its list item holds, by the rule the totals apply: it is out when it was
 * last active, by its last message or else its file time, before the window's
 * start. A session with no file time is kept, since the totals count it as
 * unreadable.
 *
 * @param times - When the session's last message was, and when its transcript was last written, either `null` when unknown.
 * @param window - The window's end, in milliseconds since the Unix epoch, and its length.
 * @returns `true` to hand it to the totals.
 */
export function mayArchivedCountInWindow(
  times: { readonly latestMs: number | null; readonly modifiedMs: number | null },
  window: { readonly nowMs: number; readonly windowMs: number }
): boolean {
  const { latestMs, modifiedMs } = times
  if (modifiedMs === null) return true
  return !isBeforeTotalsWindow({ latestMs, mtimeMs: modifiedMs }, window.nowMs - window.windowMs)
}

/**
 * Whether a session was last active before a totals window starts: by its last
 * message, else by when its transcript was last written. The one rule the
 * folder totals and the archived-session filter share.
 *
 * @param times - When the session's last message was, or `null` when it has none, and when its transcript was last written.
 * @param cutoffMs - The window's start, in milliseconds since the Unix epoch.
 * @returns `true` when the session is out of the window.
 */
export function isBeforeTotalsWindow(
  times: { readonly latestMs: number | null; readonly mtimeMs: number },
  cutoffMs: number
): boolean {
  return (times.latestMs ?? times.mtimeMs) < cutoffMs
}
