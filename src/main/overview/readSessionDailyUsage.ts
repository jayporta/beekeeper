import type { Result } from '../../core/shared/result'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { UnreadableError } from '../../core/transcript/unreadableError'
import type { SessionDailyUsage } from '../../core/usage/dailyUsage'
import { scanSessionDailyUsage } from '../../core/usage/scanSessionDailyUsage'
import type { IpcDeps } from '../ipc/ipcDeps'
import { sessionFilesKey, type SessionFilesKeyOptions } from '../ipc/sessionFilesKey'
import { createDayKeyOf } from './localDayKey'

/**
 * Reads one session's tokens by day and model, through the daily usage cache
 * and the summaries scheduler's background lane, so a person's own session
 * list is never queued behind it. Concurrent reads of the same files share
 * one scan.
 *
 * @param located - The project, the listed session, and its readable transcript.
 * @param deps - The scheduler, the cache, and the time zone to bucket days in.
 * @returns The session's usage, or the code of the system error that kept its
 * lead transcript from being read.
 * @throws {Error} When the read fails for a reason that carries no system
 * error code, since that indicates a bug rather than an unreadable file.
 */
export async function readSessionDailyUsage(
  located: SessionFilesKeyOptions,
  deps: Pick<IpcDeps, 'summaries' | 'dailyUsageCache' | 'timeZone'>
): Promise<Result<SessionDailyUsage, UnreadableError>> {
  const { session, transcript } = located
  const timeZone = deps.timeZone()
  const key = ['dailyUsage', timeZone, sessionFilesKey(located)].join('\0')
  const cached = deps.dailyUsageCache.get(key)
  if (cached !== undefined) return { ok: true, value: cached }

  const result = await captureSystemError(() =>
    deps.summaries.runInBackground(key, () =>
      scanSessionDailyUsage({
        leadPath: transcript.path,
        subagents: session.subagents.ok ? session.subagents.value : [],
        dayKeyOf: createDayKeyOf(timeZone)
      })
    )
  )
  if (result.ok) {
    deps.dailyUsageCache.set({ key, usage: result.value, subagentsListed: session.subagents.ok })
  }
  return result
}
