import type { Result } from '../../core/shared/result'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { UnreadableError } from '../../core/transcript/unreadableError'
import type { DayKey, SessionDailyUsage } from '../../core/usage/dailyUsage'
import { combineDailyUsage } from '../../core/usage/combineDailyUsage'
import { scanSessionDailyUsage } from '../../core/usage/scanSessionDailyUsage'
import {
  EMPTY_SUBAGENT_DAILY_USAGE,
  scanSubagentDailyUsage
} from '../../core/usage/scanSubagentDailyUsage'
import type { IpcDeps } from '../ipc/ipcDeps'
import { readSessionSummaryInBackground } from '../ipc/scanProjectSessions'
import { sessionFilesKey, type SessionFilesKeyOptions } from '../ipc/sessionFilesKey'

/** What {@link readSessionDailyUsage} reads through. */
export interface ReadSessionDailyUsageDeps extends Pick<
  IpcDeps,
  'dailyUsageScans' | 'dailyUsageCache' | 'summaryCache' | 'summaries'
> {
  /** The IANA time zone the days are bucketed in, which is part of the cache key. */
  readonly timeZone: string
  /** Maps an instant to its day in {@link ReadSessionDailyUsageDeps.timeZone}. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Reads one session's tokens by day and model, through the daily usage cache.
 * The lead's usage comes from its summary, read through the shared summary
 * cache in the summaries scheduler's background lane, so a lead the totals
 * already read is not read again and a person's session list never waits
 * behind it. Only the subagent transcripts are read for the chart, in the
 * daily usage scheduler. A lead too long for its summary to hold usage is
 * read in full there instead. Concurrent reads of the same files share one
 * scan. The cache holds one entry per session and time zone, so a session
 * that keeps being written to does not leave an entry behind for each state
 * of its files.
 *
 * @param located - The project, the listed session, and its readable transcript.
 * @param deps - The caches, the schedulers, and the time zone and day mapping to bucket days in.
 * @returns The session's usage, or the code of the system error that kept its
 * lead transcript from being read.
 * @throws {Error} When the read fails for a reason that carries no system
 * error code, since that indicates a bug rather than an unreadable file.
 */
export async function readSessionDailyUsage(
  located: SessionFilesKeyOptions,
  deps: ReadSessionDailyUsageDeps
): Promise<Result<SessionDailyUsage, UnreadableError>> {
  const { session, transcript } = located
  const filesKey = sessionFilesKey(located)
  // The cache holds one entry per session and time zone, which a changed session replaces.
  const cacheKey = ['dailyUsage', deps.timeZone, located.projectDirName, session.sessionId].join(
    '\0'
  )
  const cached = deps.dailyUsageCache.get({ key: cacheKey, filesKey })
  if (cached !== undefined) return { ok: true, value: cached }

  const summary = await readSessionSummaryInBackground(transcript, deps)
  if (!summary.ok) return summary
  const { leadUsage, skippedLines } = summary.value
  const subagents = session.subagents.ok ? session.subagents.value : []

  // Reads of the same files in the same zone share one scan, keyed apart by
  // kind, since a full scan's result already holds the lead. Only file reads
  // queue in the scheduler, which runs one at a time, so the merge stays outside it.
  const scanKey = (kind: string): string => [kind, deps.timeZone, filesKey].join('\0')
  const result = await captureSystemError(async () => {
    if (leadUsage === null) {
      return deps.dailyUsageScans.run(scanKey('dailyUsage'), () =>
        scanSessionDailyUsage({ leadPath: transcript.path, subagents, dayKeyOf: deps.dayKeyOf })
      )
    }
    const subagentUsage =
      subagents.length === 0
        ? EMPTY_SUBAGENT_DAILY_USAGE
        : await deps.dailyUsageScans.run(scanKey('dailyUsageSubagents'), () =>
            scanSubagentDailyUsage({
              subagents,
              leadMessageIds: leadUsage.messageIds,
              dayKeyOf: deps.dayKeyOf
            })
          )
    return combineDailyUsage({
      lead: leadUsage,
      leadSkippedLines: skippedLines,
      subagents: subagentUsage,
      dayKeyOf: deps.dayKeyOf
    })
  })
  if (result.ok) {
    deps.dailyUsageCache.set({
      key: cacheKey,
      filesKey,
      usage: result.value,
      subagentsListed: session.subagents.ok
    })
  }
  return result
}
