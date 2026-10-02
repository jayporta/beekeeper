import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Where a manual refresh stands. */
type RefreshStatus = 'idle' | 'refreshing' | 'refreshed'

/** What {@link useRefreshLists} returns. */
export interface RefreshLists {
  /** Refetches the project list and the folder's session list now, whatever their age. */
  readonly refresh: () => void
  /** Whether a refresh started from `refresh` is still running. */
  readonly refreshing: boolean
  /** Whether the last refresh finished with both lists loaded, rather than one failing. */
  readonly refreshed: boolean
}

/**
 * Refetches the project list and one folder's session list on demand. A list
 * that is already loading is reused rather than fetched again, so a press
 * while a window-focus refetch is running, or two quick presses, make one
 * call per list. A list that fails to reload keeps its data; the refresh
 * still finishes, without reporting success.
 *
 * @param dirName - The folder whose session list to refetch.
 * @returns The refresh action and where it stands.
 */
export function useRefreshLists(dirName: string): RefreshLists {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RefreshStatus>('idle')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    const queryKeys = [['projects'], ['sessions', dirName]]
    setStatus('refreshing')
    void Promise.all(
      queryKeys.map((queryKey) =>
        queryClient.refetchQueries({ queryKey }, { cancelRefetch: false })
      )
    ).then(() => {
      if (!mounted.current) return
      const failed = queryKeys.some(
        (queryKey) => queryClient.getQueryState(queryKey)?.status === 'error'
      )
      setStatus(failed ? 'idle' : 'refreshed')
    })
  }, [queryClient, dirName])

  return { refresh, refreshing: status === 'refreshing', refreshed: status === 'refreshed' }
}
