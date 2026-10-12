import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { ProjectTotalsDto } from '../../shared/ipc/projectTotalsDto'
import { getProjectTotalsRequestSchema } from '../../shared/ipc/requestSchemas'
import { archivedTimesOf } from '../overview/archivedTimes'
import { archivedTotalsSession } from '../overview/archivedTotalsSession'
import { folderTotals, type TotalsSession } from '../overview/folderTotals'
import {
  mayArchivedCountInWindow,
  mayCountInWindow,
  TOTALS_WINDOW_MS
} from '../overview/totalsWindow'
import { findProject } from '../../service/projects/findProject'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from '../../service/ipcResults'
import { mapProjectTotals } from './mapProjectTotals'
import type { ScannedSession } from '../../service/sessions/mapSessionListItem'
import { readArchivedSessions } from '../../service/sessions/readArchivedSessions'
import { scanProjectSessions } from '../../service/sessions/scanProjectSessions'

function toTotalsSession({ entry, summary }: ScannedSession): TotalsSession {
  return {
    sessionId: entry.sessionId,
    mtimeMs: entry.transcript.ok ? entry.transcript.value.mtimeMs : null,
    subagentCount: entry.subagents.ok ? entry.subagents.value.length : null,
    summary: summary.ok ? summary.value : null
  }
}

/**
 * Adds up one project folder's own sessions over a 7 or 30 day window.
 *
 * @remarks
 * Only the folder's own sessions are read, never its family's: a teammate is
 * told from a lead by its summary's role, so no other folder is scanned and no
 * team is grouped. A session whose file is older than the window by more than a
 * day is skipped without being read, since its activity can't be later than
 * that. The rest are read through the shared summary cache and scheduler, in
 * its background lane, so a session list a person asks for is never queued
 * behind them. The folder's archived sessions, those whose transcripts are no
 * longer on disk, are added from the archive, each from its list item, which
 * holds every figure the totals read. A session that is on disk is never
 * counted from the archive, even when the window left it unread. Archived
 * rows are read once and kept until they change, and those last active before
 * the window are cut before they are mapped, by the rule the totals apply. A
 * failing archive read leaves the live sessions' totals as they are.
 *
 * @param deps - The projects root, the summary cache, the summaries scheduler,
 * the archive, and the clock, which gives the end of the window.
 * @param payload - The renderer's payload, validated here.
 * @returns The totals, `invalid-request` for a bad payload, or `not-found` for
 * an unknown project. A folder that can't be read comes back as the code of its
 * system error, through the IPC guard.
 */
export async function getProjectTotalsHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'summaryCache' | 'summaries' | 'archive' | 'now'>,
  payload: unknown
): Promise<IpcResult<ProjectTotalsDto>> {
  const request = getProjectTotalsRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const project = await findProject(deps.projectsRoot, request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const nowMs = deps.now()
  const windowMs = TOTALS_WINDOW_MS[request.data.window]
  // `keep` sees every session on disk before any read, so it also gathers the live ids.
  const liveSessionIds = new Set<string>()
  const scanned = await scanProjectSessions(
    {
      project,
      keep: (entry) => {
        liveSessionIds.add(entry.sessionId)
        return mayCountInWindow(entry, { nowMs, windowMs })
      },
      background: true
    },
    deps
  )
  const archived = readArchivedSessions({
    archive: deps.archive,
    projectDirName: project.dirName,
    liveSessionIds
  })
  const inWindow = archived.filter(({ item }) =>
    mayArchivedCountInWindow(archivedTimesOf(item), { nowMs, windowMs })
  )
  const sessions = [...scanned.map(toTotalsSession), ...inWindow.map(archivedTotalsSession)]
  return okResult(mapProjectTotals(folderTotals({ sessions, nowMs, windowMs })))
}
