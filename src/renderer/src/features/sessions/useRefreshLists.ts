import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { RefreshButtonStatus } from './RefreshButton'

/** What {@link useRefreshLists} returns. */
export interface RefreshLists {
  /** Refetches the project list and the folder's session list now, whatever their age. */
  readonly refresh: () => void
  /**
   * Where the lists stand. `refreshing` while a press runs. Otherwise `failed`
   * while either list's last load failed, whatever started it: a press, a
   * window-focus refetch, or a retry. Otherwise `refreshed` when the last
   * press loaded both lists and nothing has failed since, else `idle`.
   */
  readonly status: RefreshButtonStatus
}

/** The keys of the lists a refresh covers: the projects and one folder's sessions. */
function listKeys(dirName: string): QueryKey[] {
  return [['projects'], ['sessions', dirName]]
}

/**
 * Whether either list's last load failed: its query is in the `error` state.
 * A list that fails to reload keeps its data, which would otherwise hide the
 * failure, and stays in `error` while it retries, until a load succeeds. A
 * list that never loaded goes back to `pending` while it retries, and the
 * page then says it is loading. A list restored from the persisted cache is
 * never in `error`, since the cache saves a failed reload of a list with data
 * as a success (see `toCachedQueryState`).
 */
function listsFailed(queryClient: QueryClient, dirName: string): boolean {
  return listKeys(dirName).some(
    (queryKey) => queryClient.getQueryState(queryKey)?.status === 'error'
  )
}

/**
 * How many times either list has failed to load. It grows while the lists
 * stay cached, and is restored from the cache at launch. It starts over when
 * a list is garbage-collected or removed, so a count taken earlier then
 * differs from the new one, and a refresh result tied to it no longer holds.
 */
function failureCount(queryClient: QueryClient, dirName: string): number {
  return listKeys(dirName).reduce(
    (total, queryKey) => total + (queryClient.getQueryState(queryKey)?.errorUpdateCount ?? 0),
    0
  )
}

/** What {@link pickStatus} reads. */
interface StatusInputs {
  /** Whether a press is running. */
  readonly refreshing: boolean
  /** Whether either list's last load failed. */
  readonly failed: boolean
  /** The failure count when the last press loaded both lists, or `null` when it did not. */
  readonly settledFailures: number | null
  /** How many times either list has failed to load. */
  readonly failures: number
}

/** Picks the status the button shows: see {@link RefreshLists.status}. */
function pickStatus({
  refreshing,
  failed,
  settledFailures,
  failures
}: StatusInputs): RefreshButtonStatus {
  if (refreshing) return 'refreshing'
  if (failed) return 'failed'
  return settledFailures === failures ? 'refreshed' : 'idle'
}

/**
 * Refetches the project list and one folder's session list on demand, and
 * reports whether they loaded. A list that is already loading is reused
 * rather than fetched again, so a press while a window-focus refetch is
 * running, or two quick presses, make one call per list. Failure is read from
 * the query cache, not remembered, so a failed background reload is reported
 * too, and a later successful load clears it.
 *
 * @param dirName - The folder whose session list to refetch.
 * @returns The refresh action and where the lists stand.
 */
export function useRefreshLists(dirName: string): RefreshLists {
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)
  // The failure count when the last press loaded both lists, or `null` when it did not.
  const [settledFailures, setSettledFailures] = useState<number | null>(null)
  const mounted = useRef(true)
  const subscribe = useCallback(
    (notify: () => void) => queryClient.getQueryCache().subscribe(notify),
    [queryClient]
  )
  const failed = useSyncExternalStore(subscribe, () => listsFailed(queryClient, dirName))
  const failures = useSyncExternalStore(subscribe, () => failureCount(queryClient, dirName))

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    setRefreshing(true)
    void Promise.all(
      listKeys(dirName).map((queryKey) =>
        queryClient.refetchQueries({ queryKey }, { cancelRefetch: false })
      )
    ).then(() => {
      if (!mounted.current) return
      setSettledFailures(
        listsFailed(queryClient, dirName) ? null : failureCount(queryClient, dirName)
      )
      setRefreshing(false)
    })
  }, [queryClient, dirName])

  return { refresh, status: pickStatus({ refreshing, failed, settledFailures, failures }) }
}
