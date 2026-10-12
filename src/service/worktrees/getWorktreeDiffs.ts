import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { GitAvailabilityDto, WorktreeDiffsDto } from '../../shared/ipc/worktreeDiffDto'
import { sessionWorktreeDiffs, type AgentWorktreeDiff } from './sessionWorktreeDiffs'
import type { GetSessionRequest } from '../../shared/ipc/requestSchemas'
import { findRequestedSession, type RequestedSession } from '../sessionDetail/findRequestedSession'
import { findSharedWorktree, type SharedWorktreeDeps } from './findSharedWorktree'
import type { ServiceDeps } from '../serviceDeps'
import { okResult } from '../ipcResults'
import { mapWorktreeDiffs } from './mapWorktreeDiffs'
import { scanFoundSession } from '../sessionDetail/scanFoundSession'

/** What {@link getWorktreeDiffs} reads. */
type WorktreeDiffsDeps = SharedWorktreeDeps & Pick<ServiceDeps, 'git' | 'diffs'>

interface AgentDiffs {
  readonly git: GitAvailabilityDto
  readonly agents: readonly AgentWorktreeDiff[]
}

async function computeAgentDiffs(
  deps: WorktreeDiffsDeps,
  requested: RequestedSession
): Promise<AgentDiffs> {
  const { projectDirName, found, transcript } = requested
  const located = await deps.git()
  if (!located.ok) return { git: located.error, agents: [] }

  const scan = await scanFoundSession({ deps, found, transcript })
  const agents = await sessionWorktreeDiffs({
    git: located.value,
    scan,
    projectDirName,
    scheduler: deps.diffs
  })
  return { git: 'ok', agents }
}

/**
 * Computes what each worktree agent of one session changed, and which lead
 * subagent's worktree a teammate session shares. The session scan is shared
 * with `getSession` through the scan cache, and the diffs run on the diff
 * scheduler. The diffs and `sharedWorktree` are computed concurrently.
 *
 * @param deps - The projects root, the schedulers, the scan cache, and the git locator.
 * @param request - A request parsed by `getSessionRequestSchema`, which keeps
 * its folder name and session id path-free.
 * @returns The diffs, or `not-found` when the project or session isn't in a
 * fresh listing. Without a usable git the result is
 * `{ git: <reason>, agents: [], sharedWorktree }` and the session's agents are
 * not scanned. `sharedWorktree` needs no git, so it is found either way, which
 * scans a teammate session and its lead. Per-agent failures come back as codes
 * inside the result.
 */
export async function getWorktreeDiffs(
  deps: WorktreeDiffsDeps,
  request: GetSessionRequest
): Promise<IpcResult<WorktreeDiffsDto>> {
  const requested = await findRequestedSession(deps, request)
  if (!requested.ok) return requested

  const [diffs, sharedWorktree] = await Promise.all([
    computeAgentDiffs(deps, requested.value),
    findSharedWorktree(deps, requested.value)
  ])
  return okResult(mapWorktreeDiffs({ ...diffs, sharedWorktree }))
}
