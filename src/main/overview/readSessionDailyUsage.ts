import type { Result } from '../../core/shared/result'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { UnreadableError } from '../../core/transcript/unreadableError'
import type { DayKey, SessionDailyUsage } from '../../core/usage/dailyUsage'
import { scanSessionDailyUsage } from '../../core/usage/scanSessionDailyUsage'
import type { IpcDeps } from '../ipc/ipcDeps'
import { sessionFilesKey, type SessionFilesKeyOptions } from '../ipc/sessionFilesKey'

/** What {@link readSessionDailyUsage} reads through. */
export interface ReadSessionDailyUsageDeps extends Pick<
  IpcDeps,
  'dailyUsageScans' | 'dailyUsageCache'
> {
  /** The IANA time zone the days are bucketed in, which is part of the cache key. */
  readonly timeZone: string
  /** Maps an instant to its day in {@link ReadSessionDailyUsageDeps.timeZone}. */
  readonly dayKeyOf: (epochMs: number) => DayKey
}

/**
 * Reads one session's tokens by day and model, through the daily usage cache
 * and its own scheduler, so neither a person's session list nor the totals
 * wait behind it. Concurrent reads of the same files share one scan. The
 * cache holds one entry per session and time zone, so a session that keeps
 * being written to does not leave an entry behind for each state of its files.
 *
 * @param located - The project, the listed session, and its readable transcript.
 * @param deps - The scheduler, the cache, and the time zone and day mapping to bucket days in.
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

  // Reads of the same files in the same zone share one scan.
  const scanKey = ['dailyUsage', deps.timeZone, filesKey].join('\0')
  const result = await captureSystemError(() =>
    deps.dailyUsageScans.run(scanKey, () =>
      scanSessionDailyUsage({
        leadPath: transcript.path,
        subagents: session.subagents.ok ? session.subagents.value : [],
        dayKeyOf: deps.dayKeyOf
      })
    )
  )
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
