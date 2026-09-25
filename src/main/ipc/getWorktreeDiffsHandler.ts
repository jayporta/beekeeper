import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { WorktreeDiffsDto } from '../../shared/ipc/worktreeDiffDto'
import { sessionWorktreeDiffs } from '../git/sessionWorktreeDiffs'
import { findRequestedSession } from './findRequestedSession'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'
import { mapWorktreeDiffs } from './mapWorktreeDiffs'
import { scanFoundSession } from './scanFoundSession'

/**
 * Computes what each worktree agent of one session changed. The session scan
 * is shared with `getSession` through the scan cache, and the diffs run on
 * the diff scheduler.
 *
 * @param deps - The projects root, the schedulers, the scan cache, and the git locator.
 * @param payload - The renderer's payload, validated here.
 * @returns The diffs, `invalid-request` for a bad payload, or `not-found`
 * when the project or session isn't in a fresh listing. Without a usable git
 * the result is `{ git: <reason>, agents: [] }` and nothing is scanned.
 * Per-agent failures come back as codes inside the result.
 */
export async function getWorktreeDiffsHandler(
  deps: IpcDeps,
  payload: unknown
): Promise<IpcResult<WorktreeDiffsDto>> {
  const requested = await findRequestedSession(deps, payload)
  if (!requested.ok) return requested

  const { projectDirName, found, transcript } = requested.value
  const located = await deps.git()
  if (!located.ok) return okResult({ git: located.error, agents: [] })

  const scan = await scanFoundSession({ deps, found, transcript })
  const agents = await sessionWorktreeDiffs({
    git: located.value,
    scan,
    projectDirName,
    scheduler: deps.diffs
  })
  return okResult(mapWorktreeDiffs({ git: 'ok', agents }))
}
