import { discoverSessions } from '../../core/transcript/discoverSessions'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDailyUsageDto } from '../../shared/ipc/projectDailyUsageDto'
import type { GetProjectDailyUsageRequest } from '../../shared/ipc/requestSchemas'
import { archivedDailyOutcomes } from './archivedDailyOutcomes'
import { folderDailyUsage, type SessionDailyOutcome } from './folderDailyUsage'
import { createDayKeyOf } from './localDayKey'
import { readSessionDailyUsage } from './readSessionDailyUsage'
import { mayHaveDailyUsage, TOTALS_WINDOW_MS } from './totalsWindow'
import { windowDays } from './windowDays'
import { findProject } from '../projects/findProject'
import type { ServiceDeps } from '../serviceDeps'
import { errResult, okResult } from '../ipcResults'

/**
 * Adds up one project folder's own tokens by local day and model over a 7 or
 * 30 day window.
 *
 * @remarks
 * Each message counts on the local day it ran, so only the messages inside
 * the window count, even for a session that began before it. A session whose
 * lead and subagent files are all older than the window's first day, by more
 * than a day of slack, is skipped without being read. The rest are read
 * through the daily usage cache, the shared summary cache and its background
 * lane for each lead, and the daily usage scheduler for subagents.
 * Like the totals, only the folder's own sessions are read.
 * The folder's archived sessions, those whose transcripts are no longer on
 * disk, are added from the archive by their lead slots, on the local day each
 * slot starts in. A session that is on disk is never counted from the archive,
 * even when the window left it unread. The archive keeps no subagent usage, so
 * an archived session that had subagents is counted as missing it, unless its
 * last message was before the window's first day.
 *
 * @param deps - The projects root, the daily usage and summary caches and
 * schedulers, the archive, the clock, and the time zone that decides where a
 * day begins, read once per request.
 * @param request - A request parsed by `getProjectDailyUsageRequestSchema`,
 * which keeps its folder name path-free and its window one of the known ones.
 * @returns The usage, or `not-found` for an unknown project. A folder that
 * can't be read comes back as the code of its system error, through the IPC
 * guard.
 */
export async function getProjectDailyUsage(
  deps: Pick<
    ServiceDeps,
    | 'projectsRoot'
    | 'dailyUsageScans'
    | 'dailyUsageCache'
    | 'summaryCache'
    | 'summaries'
    | 'archive'
    | 'now'
    | 'timeZone'
  >,
  request: GetProjectDailyUsageRequest
): Promise<IpcResult<ProjectDailyUsageDto>> {
  const project = await findProject(deps.projectsRoot, request.projectDirName)
  if (project === undefined) return errResult('not-found')

  const { window } = request
  const nowMs = deps.now()
  const timeZone = deps.timeZone()
  const dayKeyOf = createDayKeyOf(timeZone)
  const days = windowDays({ todayKey: dayKeyOf(nowMs), window })
  const windowMs = TOTALS_WINDOW_MS[window]
  const onDisk = await discoverSessions(project.path)
  const sessions = onDisk.filter((entry) => mayHaveDailyUsage(entry, { nowMs, windowMs }))

  const outcomes = await Promise.all(
    sessions.map(async (session): Promise<SessionDailyOutcome> => {
      if (!session.transcript.ok) return { ok: false }
      const read = await readSessionDailyUsage(
        { projectDirName: project.dirName, session, transcript: session.transcript.value },
        {
          dailyUsageScans: deps.dailyUsageScans,
          dailyUsageCache: deps.dailyUsageCache,
          summaryCache: deps.summaryCache,
          summaries: deps.summaries,
          timeZone,
          dayKeyOf
        }
      )
      return read.ok
        ? { ok: true, usage: read.value, subagentsListed: session.subagents.ok }
        : { ok: false }
    })
  )
  const archived = archivedDailyOutcomes({
    archive: deps.archive,
    projectDirName: project.dirName,
    liveSessionIds: new Set(onDisk.map((entry) => entry.sessionId)),
    window: { nowMs, windowMs },
    firstDay: days[0] ?? dayKeyOf(nowMs),
    dayKeyOf
  })
  return okResult(folderDailyUsage({ days, sessions: [...outcomes, ...archived] }))
}
