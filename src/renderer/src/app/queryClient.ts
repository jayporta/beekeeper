import { QueryClient } from '@tanstack/react-query'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
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
 * Creates the app's query client. Queries run whether or not the OS reports a
 * network connection, since every one is a local IPC call, and they do not
 * refetch on window focus or reconnect, since the data is local files that
 * change only when an agent writes them. A failure that cannot change on
 * retry (see {@link shouldRetry}) is not retried. Queries keep TanStack's default `gcTime`, except under a
 * persisted root (see `PERSISTED_QUERY_ROOTS`), which keep {@link PERSIST_MAX_AGE_MS}
 * to match the persister's `maxAge`: a query garbage-collected sooner would
 * never reach the persisted cache. A query can set a shorter `gcTime` itself,
 * and then leaves the persisted cache sooner too.
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
    client.setQueryDefaults([root], { gcTime: PERSIST_MAX_AGE_MS })
  }
  return client
}
