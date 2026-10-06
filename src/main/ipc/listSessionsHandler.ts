import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { listSessionsRequestSchema } from '../../shared/ipc/requestSchemas'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { groupProjectFamily } from './groupProjectFamily'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapSessionListItem, type ScannedSession } from './mapSessionListItem'
import { readSessionAgentTerms } from './readSessionAgentTerms'
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
 * summaries scheduler. The search terms of subagents are read, through the
 * agent terms cache and under the same scheduler, only for the sessions the
 * list holds. See {@link groupProjectFamily} for how an unreadable
 * sibling folder is treated.
 *
 * @param deps - The projects root, the summary and agent terms caches, and the
 * summaries scheduler.
 * @param payload - The renderer's payload, validated here.
 * @returns The sessions, `invalid-request` for a bad payload, or
 * `not-found` for an unknown project.
 */
export async function listSessionsHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'summaryCache' | 'summaries' | 'agentTerms'>,
  payload: unknown
): Promise<IpcResult<readonly SessionListItemDto[]>> {
  const request = listSessionsRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const projects = await discoverProjects(deps.projectsRoot)
  const project = projects.find((entry) => entry.dirName === request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const { scanned, teams } = await groupProjectFamily({ deps, project, projects })

  const items = scanned.map((session): ListedSession => ({
    session,
    team: teams.get(teamKeyOf(session)) ?? null
  }))
  const listed = items.filter((item) => isListedFor(project.dirName, item))
  return okResult(
    await Promise.all(
      listed.map(async ({ session, team }) =>
        mapSessionListItem(
          { ...session, agentTerms: await readSessionAgentTerms(session.entry, deps) },
          team
        )
      )
    )
  )
}
