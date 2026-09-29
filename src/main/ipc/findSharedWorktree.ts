import type { AgentTreeNode } from '../../core/session/agentTree'
import { discoverProjects } from '../../core/transcript/discoverProjects'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type { SharedWorktreeDto } from '../../shared/ipc/worktreeDiffDto'
import { describeError } from '../startupFailure'
import { findSession, type FoundSession } from './findProject'
import type { RequestedSession } from './findRequestedSession'
import { groupProjectFamily } from './groupProjectFamily'
import type { IpcDeps } from './ipcDeps'
import { scanFoundSession } from './scanFoundSession'
import { readSessionSummary } from './scanProjectSessions'
import { sessionRefKey } from './sessionRefKey'

type SharedWorktreeDeps = Pick<
  IpcDeps,
  'projectsRoot' | 'summaryCache' | 'summaries' | 'scans' | 'scanCache'
>

/**
 * The first subagent in tree order whose meta names `worktreePath` and a
 * worktree branch, which is what puts an agent in the lead's worktree diffs.
 */
function findOwningSubagent(node: AgentTreeNode, worktreePath: string): string | undefined {
  const { identity, metaStatus } = node
  if (
    identity.kind === 'subagent' &&
    metaStatus.status === 'ok' &&
    metaStatus.meta.worktreeBranch !== undefined &&
    metaStatus.meta.worktreePath === worktreePath
  ) {
    return identity.agentId
  }
  for (const child of node.children) {
    const found = findOwningSubagent(child, worktreePath)
    if (found !== undefined) return found
  }
  return undefined
}

/**
 * Finds the lead in a fresh listing. A folder that cannot be read is logged
 * by error code and reads as no lead, so a best-effort pointer never fails
 * the whole response.
 */
async function findLead(
  deps: SharedWorktreeDeps,
  lead: SessionRefDto
): Promise<FoundSession | undefined> {
  try {
    return await findSession({
      projectsRoot: deps.projectsRoot,
      dirName: lead.projectDirName,
      sessionId: lead.sessionId
    })
  } catch (error) {
    console.warn(`Beekeeper could not look up a teammate's lead (${describeError(error)}).`)
    return undefined
  }
}

/** Options for {@link leadWorktreeOwner}. */
interface LeadWorktreeOwnerOptions {
  /** The lead session to look in. */
  readonly lead: SessionRefDto
  /** The worktree path a subagent's meta must name. */
  readonly worktreePath: string
}

async function leadWorktreeOwner(
  deps: SharedWorktreeDeps,
  options: LeadWorktreeOwnerOptions
): Promise<string | undefined> {
  const { lead, worktreePath } = options
  const found = await findLead(deps, lead)
  if (found === undefined || !found.session.transcript.ok) return undefined
  const scan = await scanFoundSession({ deps, found, transcript: found.session.transcript.value })
  return findOwningSubagent(scan.tree, worktreePath)
}

/**
 * Finds the lead-side subagent whose worktree a teammate session works in.
 * A teammate that shares its lead's cwd while the lead works inside a plain
 * subagent's worktree changes files there, so its changes are part of that
 * subagent's worktree diff, which the lead session already computes and which
 * covers everything in that worktree. The paths are
 * compared as exact text; no filesystem or git call runs on them. A session
 * whose own summary shows it is not an agent skips the family grouping.
 *
 * @param deps - The projects root, the summary cache and scheduler, and the scan scheduler and cache.
 * @param requested - The session the renderer asked about.
 * @returns The lead and the first subagent, in tree order, whose meta
 * `worktreePath` equals the session's first cwd and that names a worktree
 * branch; or `null` when the session is not an agent session, is not a
 * grouped teammate, has no cwd, its lead cannot be read, or no such subagent
 * exists.
 */
export async function findSharedWorktree(
  deps: SharedWorktreeDeps,
  requested: RequestedSession
): Promise<SharedWorktreeDto | null> {
  const { projectDirName, sessionId, found, transcript } = requested
  const summary = await readSessionSummary(transcript, deps)
  if (!summary.ok || summary.value.role.kind !== 'agent') return null

  const projects = await discoverProjects(deps.projectsRoot)
  const { teams } = await groupProjectFamily({ deps, project: found.project, projects })
  const team = teams.get(sessionRefKey({ projectDirName, sessionId }))
  if (team?.kind !== 'teammate') return null

  const own = await scanFoundSession({ deps, found, transcript })
  if (own.leadFirstCwd === undefined) return null

  const agentId = await leadWorktreeOwner(deps, {
    lead: team.lead,
    worktreePath: own.leadFirstCwd
  })
  return agentId === undefined ? null : { lead: team.lead, agentId }
}
