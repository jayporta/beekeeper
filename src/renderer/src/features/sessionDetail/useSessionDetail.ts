import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { sessionDetailQueryOptions } from './sessionDetailQuery'

/**
 * Loads one session's agent tree and each agent's report. The result is not
 * persisted: only the project and session lists are.
 *
 * @param ref - The session to load.
 * @returns The detail query. A failed call surfaces as an `IpcCallError`.
 */
export function useSessionDetail(ref: SessionRefDto): UseQueryResult<SessionDetailDto> {
  return useQuery(sessionDetailQueryOptions(ref))
}
