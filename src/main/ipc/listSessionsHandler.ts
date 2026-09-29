import { groupTeams } from '../../core/teams/groupTeams'
import { projectFamilyOf } from '../../core/teams/projectFamily'
import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { listSessionsRequestSchema } from '../../shared/ipc/requestSchemas'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { describeError } from '../startupFailure'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapSessionListItem, type ScannedSession } from './mapSessionListItem'
import { mapSessionTeams } from './mapSessionTeams'
import { scanProjectSessions, summarizedSessions } from './scanProjectSessions'
import { sessionRefKey } from './sessionRefKey'

function teamKeyOf(session: ScannedSession): string {
  return sessionRefKey({
    projectDirName: session.projectDirName,
    sessionId: session.entry.sessionId
  })
}

/** A scanned session with its team entry. */
interface ListedSession {
  readonly session: ScannedSession
  readonly team: SessionTeamDto | null
}

/** Whether a family session belongs in the list of `projectDirName`. */
function isListedFor(projectDirName: string, { session, team }: ListedSession): boolean {
  if (session.projectDirName === projectDirName) return true
  return team?.kind === 'teammate' && team.lead.projectDirName === projectDirName
}

/**
 * Lists a project's sessions with their summaries, read through the
 * app-lifetime cache, and how each relates to a team. Teams are grouped over
 * the project's whole family (its base folder and every listed worktree
 * folder of it), so grouping never depends on which folder was asked for. The
 * list holds the project's own sessions plus any family session from another
 * folder grouped as a teammate under one of the project's leads; that
 * teammate is also listed in its own folder, under the same lead. Summary
 * reads are shared per transcript state (path, mtime, size) and capped by the
 * summaries scheduler. Only sessions whose summaries were read take part in
 * team grouping. A sibling family folder whose scan fails is logged and left
 * out: its teammates count as missing from their lead's team, and a teammate
 * whose lead it held is grouped as if that lead were absent (ungrouped, or
 * under another lead of its team). The requested folder failing to read
 * still throws.
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

  const projects = await discoverProjects(deps.projectsRoot)
  const project = projects.find((entry) => entry.dirName === request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const familyNames = projectFamilyOf(
    project.dirName,
    projects.map((entry) => entry.dirName)
  )
  const family = projects.filter((entry) => familyNames.includes(entry.dirName))
  const scanned = (
    await Promise.all(
      family.map((folder) =>
        folder.dirName === project.dirName
          ? scanProjectSessions(folder, deps)
          : scanProjectSessions(folder, deps).catch((error: unknown): ScannedSession[] => {
              console.warn(`Beekeeper skipped a project family folder (${describeError(error)}).`)
              return []
            })
      )
    )
  ).flat()
  const teams = mapSessionTeams(groupTeams(summarizedSessions(scanned)))

  const items = scanned.map((session): ListedSession => ({
    session,
    team: teams.get(teamKeyOf(session)) ?? null
  }))
  return okResult(
    items
      .filter((item) => isListedFor(project.dirName, item))
      .map(({ session, team }) => mapSessionListItem(session, team))
  )
}
