import { worktreeDiffPatch } from '../../core/git/worktreeDiffPatch'
import { toAgentId } from '../../core/transcript/ids'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { GetWorktreePatchRequest } from '../../shared/ipc/requestSchemas'
import type { WorktreePatchDto } from '../../shared/ipc/worktreePatchDto'
import { readWorktreeAgents } from './sessionWorktreeDiffs'
import { findRequestedSession } from '../sessionDetail/findRequestedSession'
import type { ServiceDeps } from '../serviceDeps'
import { errResult, okResult } from '../ipcResults'
import { mapWorktreePatch } from './mapWorktreePatch'
import { scanFoundSession } from '../sessionDetail/scanFoundSession'

/** What {@link getWorktreePatch} reads. */
type WorktreePatchDeps = Pick<
  ServiceDeps,
  'projectsRoot' | 'scans' | 'scanCache' | 'agentScans' | 'git' | 'diffs'
>

/**
 * Reads the patch of what one worktree agent changed, with the same range,
 * base, worktree confinement, and safety checks as its numstat.
 *
 * @remarks
 * The agent id is only ever compared with the agents of a fresh scan: it
 * never reaches git or a path. The session scan is shared with `getSession`
 * through the scan cache. The patch runs on the diff scheduler as its own
 * task, apart from the numstat's, and its text is cut to per-file and total
 * size caps before it crosses the bridge.
 *
 * @param deps - The projects root, the schedulers, the scan cache, and the git locator.
 * @param request - A request parsed by `getWorktreePatchRequestSchema`, which
 * keeps its folder name, session id and agent id path-free.
 * @returns The patches; `not-found` when the project or session isn't in a
 * fresh listing, or the session has no worktree agent with that id. Without a
 * usable git the result is `{ kind: 'unavailable', git }` and the session is
 * not scanned. A failure of the diff itself comes back as
 * `{ kind: 'failed', code }`.
 */
export async function getWorktreePatch(
  deps: WorktreePatchDeps,
  request: GetWorktreePatchRequest
): Promise<IpcResult<WorktreePatchDto>> {
  const { projectDirName, sessionId, agentId } = request

  const requested = await findRequestedSession(deps, { projectDirName, sessionId })
  if (!requested.ok) return requested

  const located = await deps.git()
  if (!located.ok) return okResult({ kind: 'unavailable', git: located.error })

  const scan = await scanFoundSession({
    deps,
    found: requested.value.found,
    transcript: requested.value.transcript
  })
  const [entry] = await readWorktreeAgents({
    git: located.value,
    scan,
    projectDirName,
    scheduler: deps.diffs,
    read: worktreeDiffPatch,
    kind: 'worktree-patch',
    agentId: toAgentId(agentId)
  })
  return entry === undefined ? errResult('not-found') : okResult(mapWorktreePatch(entry.result))
}
