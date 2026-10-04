import { worktreeDiffPatch } from '../../core/git/worktreeDiffPatch'
import { toAgentId } from '../../core/transcript/ids'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { getWorktreePatchRequestSchema } from '../../shared/ipc/requestSchemas'
import type { WorktreePatchDto } from '../../shared/ipc/worktreePatchDto'
import { readWorktreeAgents } from '../git/sessionWorktreeDiffs'
import { findRequestedSession } from './findRequestedSession'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapWorktreePatch } from './mapWorktreePatch'
import { scanFoundSession } from './scanFoundSession'

/**
 * Reads the patch of what one worktree agent changed, with the same range,
 * base, worktree confinement, and safety checks as its numstat.
 *
 * @remarks
 * The payload is validated first, and the agent id is only ever compared with
 * the agents of a fresh scan: it never reaches git or a path. The session scan
 * is shared with `getSession` through the scan cache. The patch runs on the
 * diff scheduler as its own task, apart from the numstat's, and its text is cut
 * to per-file and total size caps before it crosses the bridge.
 *
 * @param deps - The projects root, the schedulers, the scan cache, and the git locator.
 * @param payload - The renderer's payload, validated here.
 * @returns The patches; `invalid-request` for a bad payload; `not-found` when
 * the project or session isn't in a fresh listing, or the session has no
 * worktree agent with that id. Without a usable git the result is
 * `{ kind: 'unavailable', git }` and the session is not scanned. A failure of
 * the diff itself comes back as `{ kind: 'failed', code }`.
 */
export async function getWorktreePatchHandler(
  deps: IpcDeps,
  payload: unknown
): Promise<IpcResult<WorktreePatchDto>> {
  const request = getWorktreePatchRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')
  const { projectDirName, sessionId, agentId } = request.data

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
