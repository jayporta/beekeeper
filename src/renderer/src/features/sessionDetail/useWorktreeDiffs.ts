import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import type { WorktreeDiffsDto } from '../../../../shared/ipc/worktreeDiffDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/** What {@link useWorktreeDiffs} can be told. */
interface UseWorktreeDiffsOptions {
  /** Whether to load. While `false` it makes no call. */
  readonly enabled: boolean
  /**
   * Whether a reader that mounts while the cached diffs are past their stale
   * time refetches them, which runs git again: `true` always, `false` never,
   * or a function that decides from the cached query. With nothing cached it
   * loads either way.
   *
   * @defaultValue true
   */
  readonly refetchOnMount?: UseQueryOptions<WorktreeDiffsDto>['refetchOnMount']
}

/**
 * Loads the worktree diffs of one session's agents. It runs git, so it loads
 * only once something needs the numbers. The result is not persisted.
 *
 * @param ref - The session whose agents' diffs to load.
 * @param options - Whether to load, and whether a newly mounted reader refetches stale diffs.
 * @returns The diffs query. A failed call surfaces as an `IpcCallError`.
 */
export function useWorktreeDiffs(
  ref: SessionRefDto,
  { enabled, refetchOnMount = true }: UseWorktreeDiffsOptions
): UseQueryResult<WorktreeDiffsDto> {
  return useQuery({
    queryKey: ['worktreeDiffs', ref.projectDirName, ref.sessionId],
    queryFn: async () =>
      unwrapIpcResult(await window.beekeeper.getWorktreeDiffs(ref.projectDirName, ref.sessionId)),
    enabled,
    refetchOnMount,
    staleTime: LISTS_STALE_TIME_MS
  })
}
