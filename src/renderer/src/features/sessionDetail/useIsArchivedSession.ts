import { useQuery } from '@tanstack/react-query'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { sessionDetailQueryOptions } from './sessionDetailQuery'

/**
 * Whether a session's detail, as the view has it cached, is an archived copy.
 * It reads the session detail query without loading it, so a component deep in
 * the inspector follows the detail's state, including a refetch that turns a
 * live session into an archived one, without being handed it.
 *
 * @param ref - The session to check.
 * @returns `true` when the cached detail is archived, `false` when it is live or not cached.
 */
export function useIsArchivedSession(ref: SessionRefDto): boolean {
  const { data } = useQuery<SessionDetailDto, Error, boolean>({
    ...sessionDetailQueryOptions(ref),
    enabled: false,
    select: (detail) => detail.archived
  })
  return data === true
}
