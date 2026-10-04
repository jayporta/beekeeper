import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'

/**
 * Loads a project's sessions. Its cache lifetime is the `sessions` query
 * default, `SESSIONS_GC_TIME_MS`. Each time a load finds the folder gone
 * (`not-found`), including one after Retry, it forgets the stored selection,
 * records the folder as gone, and refreshes the project list, which may be a
 * persisted copy that still names the folder. When a load of a folder recorded
 * as gone succeeds, the folder is back, so it is selected again and the record
 * is dropped.
 *
 * @param dirName - A folder name from the project list.
 * @returns The session list query. A failed call surfaces as an `IpcCallError`.
 */
export function useSessions(dirName: string): UseQueryResult<readonly SessionListItemDto[]> {
  const queryClient = useQueryClient()
  const forgetGoneFolder = useSelectedProjectStore((state) => state.forgetGoneFolder)
  const restoreFolder = useSelectedProjectStore((state) => state.restoreFolder)
  const query = useQuery({
    queryKey: ['sessions', dirName],
    queryFn: async () => unwrapIpcResult(await window.beekeeper.listSessions(dirName))
  })
  // A refetch keeps the status and error of the failure before it, so a not-found
  // counts only once no fetch is in flight and the error is this load's own.
  const folderGone =
    query.isError && !query.isFetching && IpcCallError.codeOf(query.error) === 'not-found'

  // `errorUpdatedAt` changes with every failed load, so a not-found that follows
  // another one (the query keeps its error status and data between them) runs this again.
  useEffect(() => {
    if (!folderGone) return
    forgetGoneFolder(dirName)
    void queryClient.invalidateQueries({ queryKey: ['projects'] })
  }, [folderGone, query.errorUpdatedAt, dirName, forgetGoneFolder, queryClient])

  // `restoreFolder` reads the record from the store, so this does not subscribe to it.
  useEffect(() => {
    if (query.isSuccess) restoreFolder(dirName)
  }, [query.isSuccess, query.dataUpdatedAt, dirName, restoreFolder])

  return query
}
