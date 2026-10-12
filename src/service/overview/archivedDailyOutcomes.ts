import { combineDailyUsage } from '../../core/usage/combineDailyUsage'
import type { DayKey } from '../../core/usage/dailyUsage'
import { EMPTY_SUBAGENT_DAILY_USAGE } from '../../core/usage/scanSubagentDailyUsage'
import type { ArchivedSession } from '../archive/archivePort'
import type { ServiceDeps } from '../serviceDeps'
import { readArchivedSessions } from '../sessions/readArchivedSessions'
import { archivedTimesOf } from './archivedTimes'
import type { SessionDailyOutcome } from './folderDailyUsage'
import { mayArchivedHaveDailyUsage } from './totalsWindow'

/** Options for {@link archivedDailyOutcomes}. */
export interface ArchivedDailyOutcomesOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: ServiceDeps['archive']
  /** The folder whose archived sessions to read. */
  readonly projectDirName: string
  /** The ids of every session on disk in the folder, which the archive must not shadow. */
  readonly liveSessionIds: ReadonlySet<string>
  /** The window's end, in milliseconds since the Unix epoch, and its length. */
  readonly window: { readonly nowMs: number; readonly windowMs: number }
  /** The window's first local day. */
  readonly firstDay: DayKey
  /** Maps an instant, in epoch milliseconds, to its local day. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Reads the daily usage of a folder's archived sessions, the ones whose
 * transcripts are no longer on disk. Only a session that may have usage in the
 * window has its lead slots read. Each slot lies wholly within one local day, so
 * it counts on the day its start falls on. The archive keeps no subagent usage,
 * so a session that had subagents reports the lead's usage alone, and says so
 * unless its last message was before the window's first day: its subagents'
 * results are written to its transcript, so they ran no later than that. A
 * session whose slots can't be had (none stored, unreadable, or a failing read)
 * is unreadable. The archive never throws, so a failing archive read never
 * fails the request.
 *
 * @param options - The archive, the folder, its live ids, the window and its first day, and the day mapping.
 * @returns One outcome per archived session in range.
 */
export function archivedDailyOutcomes(
  options: ArchivedDailyOutcomesOptions
): SessionDailyOutcome[] {
  const { archive, window, firstDay, dayKeyOf } = options
  if (archive === null) return []
  return readArchivedSessions(options)
    .filter(({ item }) => mayArchivedHaveDailyUsage(archivedTimesOf(item), window))
    .map((session) => outcomeOf({ session, archive, firstDay, dayKeyOf }))
}

function outcomeOf(options: {
  readonly session: ArchivedSession
  readonly archive: NonNullable<ServiceDeps['archive']>
  readonly firstDay: DayKey
  readonly dayKeyOf: (epochMs: number) => DayKey
}): SessionDailyOutcome {
  const { session, archive, firstDay, dayKeyOf } = options
  const { item } = session
  const slots = archive.readLeadSlots({
    projectDirName: item.projectDirName,
    sessionId: item.sessionId
  })
  if (slots === null || !item.summary.ok) return { ok: false }
  const latestMs = item.summary.value.activity?.latestMs ?? null
  // Day keys are `YYYY-MM-DD`, so they compare as strings.
  const mayHaveSubagentsInWindow = latestMs === null || dayKeyOf(latestMs) >= firstDay
  return {
    ok: true,
    usage: combineDailyUsage({
      lead: slots,
      leadSkippedLines: item.summary.value.skippedLines,
      subagents: EMPTY_SUBAGENT_DAILY_USAGE,
      dayKeyOf
    }),
    subagentsListed: true,
    subagentsNotArchived: item.subagentCount !== 0 && mayHaveSubagentsInWindow
  }
}
