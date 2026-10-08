import { discoverSessions } from '../../core/transcript/discoverSessions'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectDailyUsageDto } from '../../shared/ipc/projectDailyUsageDto'
import { getProjectDailyUsageRequestSchema } from '../../shared/ipc/requestSchemas'
import { folderDailyUsage, type SessionDailyOutcome } from '../overview/folderDailyUsage'
import { createDayKeyOf } from '../overview/localDayKey'
import { readSessionDailyUsage } from '../overview/readSessionDailyUsage'
import { mayHaveDailyUsage, TOTALS_WINDOW_MS } from '../overview/totalsWindow'
import { windowDays } from '../overview/windowDays'
import { findProject } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'

/**
 * Adds up one project folder's own tokens by local day and model over a 7 or
 * 30 day window.
 *
 * @remarks
 * Each message counts on the local day it ran, so only the messages inside
 * the window count, even for a session that began before it. A session whose
 * lead and subagent files are all older than the window's first day, by more
 * than a day of slack, is skipped without being read. The rest are read
 * through the daily usage cache and the summaries scheduler's background lane.
 * Like the totals, only the folder's own sessions are read.
 *
 * @param deps - The projects root, the daily usage cache, the summaries
 * scheduler, the clock, and the time zone that decides where a day begins.
 * @param payload - The renderer's payload, validated here.
 * @returns The usage, `invalid-request` for a bad payload, or `not-found` for
 * an unknown project. A folder that can't be read comes back as the code of
 * its system error, through the IPC guard.
 */
export async function getProjectDailyUsageHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'summaries' | 'dailyUsageCache' | 'now' | 'timeZone'>,
  payload: unknown
): Promise<IpcResult<ProjectDailyUsageDto>> {
  const request = getProjectDailyUsageRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const project = await findProject(deps.projectsRoot, request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const { window } = request.data
  const nowMs = deps.now()
  const days = windowDays({ todayKey: createDayKeyOf(deps.timeZone())(nowMs), window })
  const windowMs = TOTALS_WINDOW_MS[window]
  const sessions = (await discoverSessions(project.path)).filter((entry) =>
    mayHaveDailyUsage(entry, { nowMs, windowMs })
  )

  const outcomes = await Promise.all(
    sessions.map(async (session): Promise<SessionDailyOutcome> => {
      if (!session.transcript.ok) return { ok: false }
      const read = await readSessionDailyUsage(
        { projectDirName: project.dirName, session, transcript: session.transcript.value },
        deps
      )
      return read.ok
        ? { ok: true, usage: read.value, subagentsListed: session.subagents.ok }
        : { ok: false }
    })
  )
  return okResult(folderDailyUsage({ days, sessions: outcomes }))
}
