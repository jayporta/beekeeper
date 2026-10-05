import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { sessionDetailQueryOptions } from './sessionDetailQuery'

/** What {@link useSessionDetail} can be told. */
interface UseSessionDetailOptions {
  /**
   * Whether a reader that mounts while the cached detail is past its stale time
   * refetches it. Pass `false` for a reader that only follows what another
   * reader keeps fresh. With nothing cached it loads either way.
   *
   * @defaultValue true
   */
  readonly refetchOnMount?: boolean
}

/**
 * Loads one session's agent tree and each agent's report. The result is not
 * persisted: only the project and session lists are.
 *
 * @param ref - The session to load.
 * @param options - Whether a newly mounted reader refetches stale detail.
 * @returns The detail query. A failed call surfaces as an `IpcCallError`.
 */
export function useSessionDetail(
  ref: SessionRefDto,
  { refetchOnMount = true }: UseSessionDetailOptions = {}
): UseQueryResult<SessionDetailDto> {
  return useQuery({ ...sessionDetailQueryOptions(ref), refetchOnMount })
}
