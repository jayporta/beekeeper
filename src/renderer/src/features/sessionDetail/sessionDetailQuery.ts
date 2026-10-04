import type { UseQueryOptions } from '@tanstack/react-query'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { LISTS_STALE_TIME_MS } from '@renderer/app/listsStaleTime'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'

/**
 * The query that loads one session's agent tree and each agent's report. It
 * is shared by every reader of a session's detail, so the view and a teammate
 * expanded in its graph use one cache entry. It is not persisted: only the
 * project and session lists are.
 *
 * @param ref - The session to load.
 * @returns The query options.
 */
export function sessionDetailQueryOptions(ref: SessionRefDto): UseQueryOptions<SessionDetailDto> {
  return {
    queryKey: ['session', ref.projectDirName, ref.sessionId],
    queryFn: async () =>
      unwrapIpcResult(await window.beekeeper.getSession(ref.projectDirName, ref.sessionId)),
    staleTime: LISTS_STALE_TIME_MS
  }
}
