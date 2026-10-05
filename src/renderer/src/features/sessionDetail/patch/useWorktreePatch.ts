import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { WorktreePatchDto } from '../../../../../shared/ipc/worktreePatchDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * Loads the patch of what one worktree agent changed. It runs git and can be
 * large, so only the open patch view calls it, and the result is neither
 * persisted nor kept: it is dropped when the patch view closes, so opening the
 * diff again loads it again, from the loading state.
 *
 * @param ref - The session that holds the subagent.
 * @param agentId - The subagent whose patch to load.
 * @returns The patch query. A failed call surfaces as an `IpcCallError`.
 */
export function useWorktreePatch(
  ref: SessionRefDto,
  agentId: string
): UseQueryResult<WorktreePatchDto> {
  return useQuery({
    queryKey: ['worktreePatch', ref.projectDirName, ref.sessionId, agentId],
    queryFn: async () =>
      unwrapIpcResult(
        await window.beekeeper.getWorktreePatch(ref.projectDirName, ref.sessionId, agentId)
      ),
    gcTime: 0
  })
}
