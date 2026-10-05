import type { QueryClient } from '@tanstack/react-query'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { sessionDetailQueryOptions } from '../sessionDetailQuery'

/**
 * Makes the rule for refetching a session's worktree diffs when a reader
 * mounts: only when the cached diffs were loaded before the cached session
 * detail, so the diffs follow the detail's freshness. With no detail cached
 * there is nothing newer, so the cached diffs stand.
 *
 * @param client - The query client holding both entries.
 * @param ref - The session whose diffs and detail to compare.
 * @returns A rule for `refetchOnMount`, given the diffs query. A refetch still
 * waits for the diffs to be past their stale time.
 */
export function diffsOlderThanDetail(
  client: QueryClient,
  ref: SessionRefDto
): (diffs: { readonly state: { readonly dataUpdatedAt: number } }) => boolean {
  return (diffs) => {
    const detail = client.getQueryState(sessionDetailQueryOptions(ref).queryKey)
    return diffs.state.dataUpdatedAt < (detail?.dataUpdatedAt ?? 0)
  }
}
