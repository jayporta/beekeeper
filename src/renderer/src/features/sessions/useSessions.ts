import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'

/**
 * Loads a project's sessions. When the folder no longer exists (`not-found`),
 * it forgets the stored selection and refreshes the project list, which may
 * be a persisted copy that still names the folder.
 *
 * @param dirName - A folder name from the project list.
 * @returns The session list query. A failed call surfaces as an `IpcCallError`.
 */
export function useSessions(dirName: string): UseQueryResult<readonly SessionListItemDto[]> {
  const queryClient = useQueryClient()
  const resetSelection = useSelectedProjectStore((state) => state.resetSelection)
  const query = useQuery({
    queryKey: ['sessions', dirName],
    queryFn: async () => unwrapIpcResult(await window.beekeeper.listSessions(dirName))
  })
  const folderGone = query.isError && IpcCallError.codeOf(query.error) === 'not-found'

  useEffect(() => {
    if (!folderGone) return
    resetSelection()
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [folderGone, resetSelection, queryClient])

  return query
}
