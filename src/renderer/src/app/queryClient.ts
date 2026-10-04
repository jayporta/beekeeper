import { QueryClient, type Query } from '@tanstack/react-query'
import { TOTALS_STALE_TIME_MS } from '@renderer/features/overview/totalsStaleTime'
import { hasProjectsToShow } from '@renderer/features/projects/hasProjectsToShow'
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
 * Whether a list query refetches when the window regains focus. Not while it
 * is in error status and `showsErrorScreen` says the page shows that failure
 * as an error screen: a refetch would replace that screen, including a Retry
 * button that may hold focus, with a loading message, or announce the same
 * alert again. That failure waits for an explicit Retry or Refresh. Any other
 * list refetches, so it recovers on its own once the files can be read again,
 * including a failed list that keeps showing its data.
 *
 * @param showsErrorScreen - Whether the page shows an error screen for a failed list holding this data and error.
 * @returns A predicate for `refetchOnWindowFocus`.
 */
function refetchUnlessErrorScreen(
  showsErrorScreen: (data: unknown, error: unknown) => boolean
): (query: Query) => boolean {
  return (query) =>
    query.state.status !== 'error' || !showsErrorScreen(query.state.data, query.state.error)
}

/**
 * The focus rule a list gets by default: a failed list with no data shows an
 * error screen, and a failed list with data keeps showing that data, except
 * when its folder is gone (`not-found`), which `SessionsBody` shows as an
 * alert whatever the data.
 */
const refetchListOnFocus = refetchUnlessErrorScreen(
  (data, error) => data === undefined || IpcCallError.codeOf(error) === 'not-found'
)

/**
 * The focus rule for the project list: `ProjectsGate` shows an error screen
 * for a failed list with no projects to show, loaded or not.
 */
const refetchProjectsOnFocus = refetchUnlessErrorScreen((data) => !hasProjectsToShow(data))

/**
 * What the project and session lists share: they refetch on window focus once
 * stale, since agents keep writing while the app is open, except a failed list
 * the page shows an error screen for (see {@link refetchListOnFocus}).
 * `projects` replaces the rule with {@link refetchProjectsOnFocus}.
 */
const LIST_DEFAULTS = {
  refetchOnWindowFocus: refetchListOnFocus,
  staleTime: LISTS_STALE_TIME_MS
} as const

/**
 * What a folder's totals get: they refetch on window focus once older than
 * {@link TOTALS_STALE_TIME_MS}, which also retries one that failed with nothing
 * to show, since no error screen holds a Retry button that a refetch would
 * replace. Each totals request reads a whole folder, hence the longer stale
 * time than a list's.
 */
const TOTALS_DEFAULTS = {
  refetchOnWindowFocus: true,
  staleTime: TOTALS_STALE_TIME_MS
} as const

/**
 * Creates the app's query client. Queries run whether or not the OS reports a
 * network connection, since every one is a local IPC call, and they do not
 * refetch on reconnect. They do not refetch on window focus either, except
 * the project and session lists and each folder's totals: those are local files
 * that agents keep writing while the app is open, so they refetch on focus once
 * older than {@link LISTS_STALE_TIME_MS} (the totals, which cost more to read,
 * {@link TOTALS_STALE_TIME_MS}), except a failed list the page shows an error
 * screen for, which waits for an explicit Retry or Refresh (see
 * {@link refetchListOnFocus} and {@link refetchProjectsOnFocus}, which
 * differ because the two pages show different screens). A folder's totals have
 * no such screen, so a failed one with nothing to show is refetched too. A failure that cannot
 * change on retry (see {@link shouldRetry}) is not retried. Queries keep TanStack's default `gcTime`, except under a
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
    client.setQueryDefaults([root], {
      gcTime: PERSIST_MAX_AGE_MS,
      ...(root === 'projectTotals' ? TOTALS_DEFAULTS : LIST_DEFAULTS),
      ...(root === 'projects' && { refetchOnWindowFocus: refetchProjectsOnFocus })
    })
  }
  client.setQueryDefaults(['sessions'], { gcTime: SESSIONS_GC_TIME_MS, ...LIST_DEFAULTS })
  return client
}
