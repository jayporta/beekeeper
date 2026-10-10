import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { listSessionsRequestSchema } from '../../shared/ipc/requestSchemas'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { archiveListedSessions, type ListedItem } from './archiveListedSessions'
import { groupProjectFamily } from './groupProjectFamily'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapSessionListItem, type ScannedSession } from './mapSessionListItem'
import { readSessionAgentTerms } from './readSessionAgentTerms'
import { readSessionWorkflowRunNames } from './readSessionWorkflowRunNames'
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

/** A session's folder and team entry, which decide whether a list holds it. */
interface FolderTeam {
  /** The folder the session lives in. */
  readonly folder: string
  /** The session's team entry, or `null` when it has none. */
  readonly team: SessionTeamDto | null
}

/** Whether a family session belongs in the list of `projectDirName`. */
function isListedFor(projectDirName: string, { folder, team }: FolderTeam): boolean {
  if (folder === projectDirName) return true
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
 * summaries scheduler. The search terms of subagents and the names of
 * workflow runs are read, through their caches and under the same scheduler,
 * only for the sessions the list holds. See {@link groupProjectFamily} for
 * how an unreadable sibling folder is treated. The folder's own sessions with
 * a readable summary are archived. The archived sessions whose transcripts
 * are gone from their folder join the grouping, and are appended, marked
 * archived, with the team they were grouped into: the folder's own, plus a
 * sibling folder's archived teammate of one of the folder's leads, as for live
 * sessions. A failing archive write or read never changes the live list.
 *
 * @param deps - The projects root, the summary, agent terms and workflow run
 * names caches, the summaries scheduler, and the archive.
 * @param payload - The renderer's payload, validated here.
 * @returns The sessions, `invalid-request` for a bad payload, or
 * `not-found` for an unknown project.
 */
export async function listSessionsHandler(
  deps: Pick<
    IpcDeps,
    'projectsRoot' | 'summaryCache' | 'summaries' | 'agentTerms' | 'workflowRunNames' | 'archive'
  >,
  payload: unknown
): Promise<IpcResult<readonly SessionListItemDto[]>> {
  const request = listSessionsRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const projects = await discoverProjects(deps.projectsRoot)
  const project = projects.find((entry) => entry.dirName === request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const { scanned, archived, teams } = await groupProjectFamily({ deps, project, projects })

  const items = scanned.map((session): ListedSession => ({
    session,
    team: teams.get(teamKeyOf(session)) ?? null
  }))
  const listed = items.filter(({ session, team }) =>
    isListedFor(project.dirName, { folder: session.projectDirName, team })
  )
  const listedItems = await Promise.all(
    listed.map(async ({ session, team }): Promise<ListedItem> => {
      const [agentTerms, workflowRunNames] = await Promise.all([
        readSessionAgentTerms(session.entry, deps),
        readSessionWorkflowRunNames(session.entry, deps)
      ])
      return {
        session,
        item: mapSessionListItem({ ...session, agentTerms, workflowRunNames }, team)
      }
    })
  )
  archiveListedSessions({
    archive: deps.archive,
    projectDirName: project.dirName,
    listed: listedItems
  })
  const archivedItems = archived.flatMap(({ item }): SessionListItemDto[] => {
    const team = teams.get(sessionRefKey(item)) ?? null
    return isListedFor(project.dirName, { folder: item.projectDirName, team })
      ? [{ ...item, archived: true, team }]
      : []
  })
  return okResult([...listedItems.map(({ item }) => item), ...archivedItems])
}
