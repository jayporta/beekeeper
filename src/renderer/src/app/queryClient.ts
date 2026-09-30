import { QueryClient } from '@tanstack/react-query'

/** How long a persisted query cache is kept in IndexedDB: 7 days, in milliseconds. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Creates the app's query client. It does not refetch on window focus or
 * reconnect, since the data is local files that change only when an agent
 * writes them. Its `gcTime` matches the persister's `maxAge`, because a
 * query garbage-collected sooner would never reach the persisted cache.
 *
 * @returns A new query client.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        gcTime: PERSIST_MAX_AGE_MS
      }
    }
  })
}
