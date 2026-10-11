import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { GitAvailabilityDto, WorktreeDiffsDto } from '../../shared/ipc/worktreeDiffDto'
import { sessionWorktreeDiffs, type AgentWorktreeDiff } from '../git/sessionWorktreeDiffs'
import { getSessionRequestSchema } from '../../shared/ipc/requestSchemas'
import {
  findRequestedSession,
  type RequestedSession
} from '../../service/sessionDetail/findRequestedSession'
import { findSharedWorktree } from './findSharedWorktree'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from '../../service/ipcResults'
import { mapWorktreeDiffs } from './mapWorktreeDiffs'
import { scanFoundSession } from '../../service/sessionDetail/scanFoundSession'

interface AgentDiffs {
  readonly git: GitAvailabilityDto
  readonly agents: readonly AgentWorktreeDiff[]
}

async function computeAgentDiffs(deps: IpcDeps, requested: RequestedSession): Promise<AgentDiffs> {
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
 * @param payload - The renderer's payload, validated here.
 * @returns The diffs, `invalid-request` for a bad payload, or `not-found`
 * when the project or session isn't in a fresh listing. Without a usable git
 * the result is `{ git: <reason>, agents: [], sharedWorktree }` and the
 * session's agents are not scanned. `sharedWorktree` needs no git, so it is
 * found either way, which scans a teammate session and its lead. Per-agent
 * failures come back as codes inside the result.
 */
export async function getWorktreeDiffsHandler(
  deps: IpcDeps,
  payload: unknown
): Promise<IpcResult<WorktreeDiffsDto>> {
  const request = getSessionRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')
  const requested = await findRequestedSession(deps, request.data)
  if (!requested.ok) return requested

  const [diffs, sharedWorktree] = await Promise.all([
    computeAgentDiffs(deps, requested.value),
    findSharedWorktree(deps, requested.value)
  ])
  return okResult(mapWorktreeDiffs({ ...diffs, sharedWorktree }))
}
