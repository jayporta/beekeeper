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
