import { groupTeams } from '../../core/teams/groupTeams'
import type { SummarizedSession } from '../../core/teams/teamGrouping'
import { err } from '../../core/shared/result'
import { discoverSessions, type SessionEntry } from '../../core/transcript/discoverSessions'
import type { ProjectDirName } from '../../core/transcript/ids'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { listSessionsRequestSchema } from '../../shared/ipc/requestSchemas'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import { findProject } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapSessionListItem, type ScannedSession } from './mapSessionListItem'
import { mapSessionTeams } from './mapSessionTeams'

async function scanSession(
  entry: SessionEntry,
  deps: Pick<IpcDeps, 'summaryCache' | 'summaries'>
): Promise<ScannedSession> {
  if (!entry.transcript.ok) return { entry, summary: err(entry.transcript.error) }

  const file = entry.transcript.value
  const summary = await deps.summaries.run(`${file.path}\0${file.mtimeMs}\0${file.size}`, () =>
    deps.summaryCache.read(file)
  )
  return { entry, summary }
}

/** The sessions whose summaries were read, as the team grouping takes them. */
function summarizedSessions(
  scanned: readonly ScannedSession[],
  projectDirName: ProjectDirName
): SummarizedSession[] {
  return scanned.flatMap(({ entry, summary }) =>
    summary.ok
      ? [{ ref: { projectDirName, sessionId: entry.sessionId }, summary: summary.value }]
      : []
  )
}

/**
 * Lists a project's sessions with their summaries, read through the
 * app-lifetime cache, and how each relates to a team. Summary reads are
 * shared per transcript state (path, mtime, size) and capped by the
 * summaries scheduler. Only sessions whose summaries were read take part in
 * team grouping.
 *
 * @param deps - The projects root, the summary cache, and the summaries
 * scheduler.
 * @param payload - The renderer's payload, validated here.
 * @returns The sessions, `invalid-request` for a bad payload, or
 * `not-found` for an unknown project.
 */
export async function listSessionsHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'summaryCache' | 'summaries'>,
  payload: unknown
): Promise<IpcResult<readonly SessionListItemDto[]>> {
  const request = listSessionsRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const project = await findProject(deps.projectsRoot, request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const sessions = await discoverSessions(project.path)
  const scanned = await Promise.all(sessions.map((entry) => scanSession(entry, deps)))
  const teams = mapSessionTeams(groupTeams(summarizedSessions(scanned, project.dirName)))
  return okResult(
    scanned.map((session) =>
      mapSessionListItem(session, teams.get(session.entry.sessionId) ?? null)
    )
  )
}
