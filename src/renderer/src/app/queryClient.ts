import { QueryClient, type Query } from '@tanstack/react-query'
import { SESSIONS_GC_TIME_MS } from '@renderer/features/sessions/sessionsGcTime'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { LISTS_STALE_TIME_MS } from './listsStaleTime'
import { PERSIST_MAX_AGE_MS } from './persistMaxAge'
import { PERSISTED_QUERY_ROOTS } from './shouldPersistQuery'

/** TanStack's own default: retry a failed query three times. */
const DEFAULT_RETRY_COUNT = 3

/**
 * Whether a failed query is tried again. Only an internal failure might pass
 * on a second try: an unreadable or missing folder, a rejected request, or an
 * untrusted sender fails the same way every time, so those fail at once.
 * Internal failures keep TanStack's default count.
 *
 * @param failureCount - How many times the query has failed so far.
 * @param error - What the last attempt threw.
 * @returns `true` to retry.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  return IpcCallError.codeOf(error) === 'internal' && failureCount < DEFAULT_RETRY_COUNT
}

/**
 * Whether a list query refetches when the window regains focus. A query in
 * error status with no rows to show does not, so that failure waits for an
 * explicit Retry or Refresh instead of swapping its error state for loading
 * behind the user's focus. A failed list that still shows rows does refetch,
 * so a list recovers on its own once the files can be read again.
 *
 * @param query - The list query the focus event reached.
 * @returns `true` to refetch once the query is stale.
 */
function refetchListOnFocus(query: Query): boolean {
  const { data, status } = query.state
  return status !== 'error' || (Array.isArray(data) && data.length > 0)
}

/**
 * What the project and session lists share: they refetch on window focus once
 * stale, since agents keep writing while the app is open, except a failed list
 * with no rows to show (see {@link refetchListOnFocus}).
 */
const LIST_DEFAULTS = {
  refetchOnWindowFocus: refetchListOnFocus,
  staleTime: LISTS_STALE_TIME_MS
} as const

/**
 * Creates the app's query client. Queries run whether or not the OS reports a
 * network connection, since every one is a local IPC call, and they do not
 * refetch on reconnect. They do not refetch on window focus either, except
 * the project and session lists: those are local files that agents keep
 * writing while the app is open, so they refetch on focus once older than
 * {@link LISTS_STALE_TIME_MS}, except a failed list with no rows to show, which
 * waits for an explicit Retry or Refresh. A failure that cannot change on retry
 * (see {@link shouldRetry}) is not retried. Queries keep TanStack's default `gcTime`, except under a
 * persisted root (see `PERSISTED_QUERY_ROOTS`), which keep {@link PERSIST_MAX_AGE_MS}
 * to match the persister's `maxAge`: a query garbage-collected sooner would
 * never reach the persisted cache. `sessions` queries instead keep
 * `SESSIONS_GC_TIME_MS`, so a folder's list leaves the persisted cache soon
 * after nothing shows it. Both are query defaults rather than per-query
 * options because a query restored from the persisted cache gets only the
 * defaults, and TanStack never lowers a query's `gcTime` after that.
 *
 * @returns A new query client.
 */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
      }
    }
  })
  for (const root of PERSISTED_QUERY_ROOTS) {
    client.setQueryDefaults([root], { gcTime: PERSIST_MAX_AGE_MS, ...LIST_DEFAULTS })
  }
  client.setQueryDefaults(['sessions'], { gcTime: SESSIONS_GC_TIME_MS, ...LIST_DEFAULTS })
  return client
}
