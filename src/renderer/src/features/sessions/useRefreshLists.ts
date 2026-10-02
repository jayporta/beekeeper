import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RefreshButtonStatus } from '@renderer/components/RefreshButton'

/** What {@link useRefreshLists} returns. */
export interface RefreshLists {
  /** Refetches the project list and the folder's session list now, whatever their age. */
  readonly refresh: () => void
  /**
   * Where the last refresh stands: `refreshing` while it runs, then `refreshed`
   * when both lists loaded or `failed` when either did not. A new `refresh`
   * clears a failure, and so does any later load that leaves neither list in
   * error, such as a window-focus refetch.
   */
  readonly status: RefreshButtonStatus
}

/** The keys of the lists a refresh covers: the projects and one folder's sessions. */
function listKeys(dirName: string): QueryKey[] {
  return [['projects'], ['sessions', dirName]]
}

/** Whether either list's last load failed. A list that fails to reload keeps its data. */
function listsFailed(queryClient: QueryClient, dirName: string): boolean {
  return listKeys(dirName).some(
    (queryKey) => queryClient.getQueryState(queryKey)?.status === 'error'
  )
}

/**
 * Refetches the project list and one folder's session list on demand. A list
 * that is already loading is reused rather than fetched again, so a press
 * while a window-focus refetch is running, or two quick presses, make one
 * call per list. A list that fails to reload keeps its data, and the refresh
 * reports `failed` until either a new refresh or a later load clears it.
 *
 * @param dirName - The folder whose session list to refetch.
 * @returns The refresh action and where it stands.
 */
export function useRefreshLists(dirName: string): RefreshLists {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RefreshButtonStatus>('idle')
  const mounted = useRef(true)
  const stillFailed = useSyncExternalStore(
    useCallback((notify) => queryClient.getQueryCache().subscribe(notify), [queryClient]),
    () => listsFailed(queryClient, dirName)
  )

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    setStatus('refreshing')
    void Promise.all(
      listKeys(dirName).map((queryKey) =>
        queryClient.refetchQueries({ queryKey }, { cancelRefetch: false })
      )
    ).then(() => {
      if (mounted.current) setStatus(listsFailed(queryClient, dirName) ? 'failed' : 'refreshed')
    })
  }, [queryClient, dirName])

  return { refresh, status: status === 'failed' && !stillFailed ? 'idle' : status }
}
