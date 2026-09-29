import { compareCodeUnits } from '../shared/compareCodeUnits'
import type { SummarizedSession } from './teamGrouping'

function compareRef(a: SummarizedSession, b: SummarizedSession): number {
  return (
    compareCodeUnits(a.ref.projectDirName, b.ref.projectDirName) ||
    compareCodeUnits(a.ref.sessionId, b.ref.sessionId)
  )
}

function startMs(session: SummarizedSession): number | null {
  return session.summary.activity?.earliestMs ?? null
}

/**
 * Orders sessions by their activity start, earliest first, with a session
 * that has none sorting last. Ties, including two sessions with no
 * activity, break by {@link SessionRef} in code-unit order.
 * @param a - A session.
 * @param b - Another session.
 * @returns Negative when `a` sorts first, positive when `b` does, `0` when equal.
 */
export function compareByActivityThenRef(a: SummarizedSession, b: SummarizedSession): number {
  const [am, bm] = [startMs(a), startMs(b)]
  if (am === null || bm === null) return am === bm ? compareRef(a, b) : am === null ? 1 : -1
  return am - bm || compareRef(a, b)
}

/** Orders sessions by their activity start, latest first, ties broken by {@link SessionRef}. */
function compareLatestStartThenRef(a: SummarizedSession, b: SummarizedSession): number {
  const [am, bm] = [startMs(a), startMs(b)]
  if (am === null || bm === null) return compareRef(a, b)
  return bm - am || compareRef(a, b)
}

/**
 * How long, in milliseconds, a lead's last record may precede a teammate's
 * start before the lead no longer claims that teammate. The allowance keeps
 * a lead that exits right after spawning its teammate as that teammate's lead.
 */
export const LEAD_END_GRACE_MS = 60_000

/** Whether the candidate's activity is known and ended more than the grace period before the start. */
function endedBefore(candidate: SummarizedSession, teammateStartMs: number): boolean {
  const activity = candidate.summary.activity
  return activity !== null && activity.latestMs + LEAD_END_GRACE_MS < teammateStartMs
}

/**
 * Picks the winning lead among candidates that spawned a teammate's pair
 * or team, by activity time. A candidate whose activity ended more than
 * {@link LEAD_END_GRACE_MS} before the teammate started is dropped first,
 * since a finished lead does not claim a later teammate that reuses its
 * pair or team. Among the rest, the winner is the candidate whose span
 * contains the teammate's start, else the latest candidate that started at
 * or before it, else the earliest candidate. Ties break by
 * {@link SessionRef} order. A candidate with no activity is never dropped,
 * but never contains or precedes the start either, so it wins only when no
 * remaining candidate has any activity; a teammate with no activity gets
 * the earliest-starting candidate.
 *
 * @param allCandidates - The leads that spawned the teammate's pair or team; must be non-empty.
 * @param teammateStartMs - The teammate's `activity.earliestMs`, or `null` when it has none.
 * @returns The winning lead, or `null` when every candidate's known activity
 * ended more than {@link LEAD_END_GRACE_MS} before the teammate started.
 * @throws {Error} When `allCandidates` is empty.
 */
export function pickLead(
  allCandidates: readonly SummarizedSession[],
  teammateStartMs: number | null
): SummarizedSession | null {
  if (allCandidates.length === 0) throw new Error('pickLead requires at least one candidate')

  const candidates =
    teammateStartMs === null
      ? allCandidates
      : allCandidates.filter((c) => !endedBefore(c, teammateStartMs))
  if (candidates.length === 0) return null

  if (teammateStartMs !== null) {
    const containing = candidates.filter((c) => {
      const activity = c.summary.activity
      return (
        activity !== null &&
        activity.earliestMs <= teammateStartMs &&
        teammateStartMs <= activity.latestMs
      )
    })
    if (containing.length > 0) {
      return containing.reduce((best, c) => (compareRef(c, best) < 0 ? c : best))
    }

    const startedBefore = candidates.filter((c) => {
      const activity = c.summary.activity
      return activity !== null && activity.earliestMs <= teammateStartMs
    })
    if (startedBefore.length > 0) {
      return startedBefore.reduce((best, c) => (compareLatestStartThenRef(c, best) < 0 ? c : best))
    }
  }

  return candidates.reduce((best, c) => (compareByActivityThenRef(c, best) < 0 ? c : best))
}
