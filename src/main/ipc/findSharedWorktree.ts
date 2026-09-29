import type { AgentTreeNode } from '../../core/session/agentTree'
import { discoverProjects, type ProjectEntry } from '../../core/transcript/discoverProjects'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type { SharedWorktreeDto } from '../../shared/ipc/worktreeDiffDto'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import type { FoundSession } from './findProject'
import type { RequestedSession } from './findRequestedSession'
import { groupProjectFamily, type ProjectFamilyGrouping } from './groupProjectFamily'
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

/** Options for {@link leadWorktreeOwner}. */
interface LeadWorktreeOwnerOptions {
  /** The lead session as the family grouping listed and scanned it. */
  readonly lead: FoundSession
  /** The worktree path a subagent's meta must name. */
  readonly worktreePath: string
}

/**
 * Scans the lead and finds the subagent owning `worktreePath`. A lead that
 * cannot be read (a system error with a code) is logged by that code and
 * reads as no owner, so a best-effort pointer never fails the whole response.
 * Any other error, Node's own `ERR_*` programmer errors included, is a bug
 * and is rethrown.
 */
async function leadWorktreeOwner(
  deps: SharedWorktreeDeps,
  options: LeadWorktreeOwnerOptions
): Promise<string | undefined> {
  const { lead, worktreePath } = options
  const { transcript } = lead.session
  if (!transcript.ok) return undefined
  const scan = await captureSystemError(() =>
    scanFoundSession({ deps, found: lead, transcript: transcript.value })
  )
  if (!scan.ok) {
    console.warn(`Beekeeper could not scan a teammate's lead (${scan.error.code}).`)
    return undefined
  }
  return findOwningSubagent(scan.value.tree, worktreePath)
}

/**
 * Picks the lead's project and session from what the family grouping listed,
 * so the lead is not listed a second time.
 */
function pickLead(
  listed: { readonly grouping: ProjectFamilyGrouping; readonly projects: readonly ProjectEntry[] },
  lead: SessionRefDto
): FoundSession | undefined {
  const { grouping, projects } = listed
  const project = projects.find((entry) => entry.dirName === lead.projectDirName)
  const scanned = grouping.scanned.find(
    (session) =>
      session.projectDirName === lead.projectDirName && session.entry.sessionId === lead.sessionId
  )
  return project === undefined || scanned === undefined
    ? undefined
    : { project, session: scanned.entry }
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
 * grouped teammate, has no cwd, its lead's scan fails with a system error,
 * or no such subagent exists.
 * @throws {Error} When the lead's scan fails with an error that has no system
 * error code, or with one of Node's own `ERR_*` codes, since that is a bug.
 */
export async function findSharedWorktree(
  deps: SharedWorktreeDeps,
  requested: RequestedSession
): Promise<SharedWorktreeDto | null> {
  const { projectDirName, sessionId, found, transcript } = requested
  const summary = await readSessionSummary(transcript, deps)
  if (!summary.ok || summary.value.role.kind !== 'agent') return null

  const projects = await discoverProjects(deps.projectsRoot)
  const grouping = await groupProjectFamily({ deps, project: found.project, projects })
  const team = grouping.teams.get(sessionRefKey({ projectDirName, sessionId }))
  if (team?.kind !== 'teammate') return null

  const own = await scanFoundSession({ deps, found, transcript })
  if (own.leadFirstCwd === undefined) return null

  const lead = pickLead({ grouping, projects }, team.lead)
  if (lead === undefined) return null
  const agentId = await leadWorktreeOwner(deps, { lead, worktreePath: own.leadFirstCwd })
  return agentId === undefined ? null : { lead: team.lead, agentId }
}
