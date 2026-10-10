import { combineDailyUsage } from '../../core/usage/combineDailyUsage'
import type { DayKey } from '../../core/usage/dailyUsage'
import { EMPTY_SUBAGENT_DAILY_USAGE } from '../../core/usage/scanSubagentDailyUsage'
import type { ArchivedSession } from '../archive/archiveStoreTypes'
import { guardArchiveCall } from '../archive/guardArchiveCall'
import type { IpcDeps } from '../ipc/ipcDeps'
import { readArchivedSessions } from '../ipc/readArchivedSessions'
import { archivedTimesOf } from './archivedTimes'
import type { SessionDailyOutcome } from './folderDailyUsage'
import { mayArchivedHaveDailyUsage } from './totalsWindow'

/** Options for {@link archivedDailyOutcomes}. */
export interface ArchivedDailyOutcomesOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: IpcDeps['archive']
  /** The folder whose archived sessions to read. */
  readonly projectDirName: string
  /** The ids of every session on disk in the folder, which the archive must not shadow. */
  readonly liveSessionIds: ReadonlySet<string>
  /** The window's end, in milliseconds since the Unix epoch, and its length. */
  readonly window: { readonly nowMs: number; readonly windowMs: number }
  /** Maps an instant, in epoch milliseconds, to its local day. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Reads the daily usage of a folder's archived sessions, the ones whose
 * transcripts are no longer on disk. Only a session that may have usage in the
 * window has its lead slots read. Each slot lies wholly within one local day, so
 * it counts on the day its start falls on. The archive keeps no subagent usage,
 * so a session that had subagents reports the lead's usage alone and says so. A
 * session whose slots can't be had (none stored, unreadable, or a failing read)
 * is unreadable. A failing archive read is logged once per kind and never fails
 * the request.
 *
 * @param options - The archive, the folder, its live ids, the window, and the day mapping.
 * @returns One outcome per archived session in range.
 */
export function archivedDailyOutcomes(
  options: ArchivedDailyOutcomesOptions
): SessionDailyOutcome[] {
  const { archive, window, dayKeyOf } = options
  if (archive === null) return []
  return readArchivedSessions(options)
    .filter(({ item }) => mayArchivedHaveDailyUsage(archivedTimesOf(item), window))
    .map((session) => outcomeOf({ session, archive, dayKeyOf }))
}

function outcomeOf(options: {
  readonly session: ArchivedSession
  readonly archive: NonNullable<IpcDeps['archive']>
  readonly dayKeyOf: (epochMs: number) => DayKey
}): SessionDailyOutcome {
  const { session, archive, dayKeyOf } = options
  const { item } = session
  const slots = guardArchiveCall({
    run: () =>
      archive.readLeadSlots({ projectDirName: item.projectDirName, sessionId: item.sessionId }),
    fallback: null,
    kind: 'read'
  })
  if (slots === null || !item.summary.ok) return { ok: false }
  return {
    ok: true,
    usage: combineDailyUsage({
      lead: slots,
      leadSkippedLines: item.summary.value.skippedLines,
      subagents: EMPTY_SUBAGENT_DAILY_USAGE,
      dayKeyOf
    }),
    subagentsListed: true,
    subagentsNotArchived: item.subagentCount !== 0
  }
}
