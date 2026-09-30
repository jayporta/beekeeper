import { QueryClient } from '@tanstack/react-query'
import { PERSIST_MAX_AGE_MS } from './persistMaxAge'
import { PERSISTED_QUERY_ROOTS } from './shouldPersistQuery'

/**
 * Creates the app's query client. It does not refetch on window focus or
 * reconnect, since the data is local files that change only when an agent
 * writes them. Queries keep TanStack's default `gcTime`, except under a
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
