import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import type { WorktreeDiffsDto } from '../../../../shared/ipc/worktreeDiffDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * Loads the worktree diffs of one session's agents. It runs git, so it loads
 * only once something needs the numbers. The result is not persisted.
 *
 * @param ref - The session whose agents' diffs to load.
 * @param enabled - Whether to load. While `false` it makes no call.
 * @returns The diffs query. A failed call surfaces as an `IpcCallError`.
 */
export function useWorktreeDiffs(
  ref: SessionRefDto,
  enabled: boolean
): UseQueryResult<WorktreeDiffsDto> {
  return useQuery({
    queryKey: ['worktreeDiffs', ref.projectDirName, ref.sessionId],
    queryFn: async () =>
      unwrapIpcResult(await window.beekeeper.getWorktreeDiffs(ref.projectDirName, ref.sessionId)),
    enabled,
    staleTime: LISTS_STALE_TIME_MS
  })
}
