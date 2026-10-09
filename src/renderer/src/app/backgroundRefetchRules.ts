import type { Query } from '@tanstack/react-query'
import { hasProjectsToShow } from '@renderer/features/projects/hasProjectsToShow'
import { IpcCallError } from '@renderer/ipc/ipcCallError'

/**
 * Whether a query is refetched in the background: not while it is in error
 * status and `showsErrorScreen` says the page shows that failure as an error
 * screen. A refetch would replace that screen, including a Retry button that
 * may hold focus, with a loading message, or announce the same alert again.
 * That failure waits for an explicit Retry or Refresh. Any other query
 * refetches, so it recovers on its own once the files can be read again,
 * including a failed query that keeps showing its data.
 *
 * @param showsErrorScreen - Whether the page shows an error screen for a failed query holding this data and error.
 * @returns A predicate on a query.
 */
function refetchUnlessErrorScreen(
  showsErrorScreen: (data: unknown, error: unknown) => boolean
): (query: Query) => boolean {
  return (query) =>
    query.state.status !== 'error' || !showsErrorScreen(query.state.data, query.state.error)
}

/**
 * The rule a session list gets by default: a failed list with no data shows an
 * error screen, and a failed list with data keeps showing that data, except
 * when its folder is gone (`not-found`), which `SessionsBody` shows as an
 * alert whatever the data.
 */
export const refetchListOnFocus = refetchUnlessErrorScreen(
  (data, error) => data === undefined || IpcCallError.codeOf(error) === 'not-found'
)

/**
 * The rule for the project list: `ProjectsGate` shows an error screen
 * for a failed list with no projects to show, loaded or not.
 */
export const refetchProjectsOnFocus = refetchUnlessErrorScreen((data) => !hasProjectsToShow(data))

/** The rule for one session's detail: a failed load with no data shows an error screen. */
const refetchSessionDetail = refetchUnlessErrorScreen((data) => data === undefined)

/**
 * Whether a query may be refetched without the person asking, on a window
 * focus or a live update. It applies the error-screen rule of the page that
 * shows the query: the project list, a session list, or a session's detail.
 * A query under any other root is always allowed.
 *
 * @param query - The cached query.
 * @returns `true` when a background refetch won't replace an error screen.
 */
export function allowsBackgroundRefetch(query: Query): boolean {
  switch (query.queryKey[0]) {
    case 'projects':
      return refetchProjectsOnFocus(query)
    case 'sessions':
      return refetchListOnFocus(query)
    case 'session':
      return refetchSessionDetail(query)
    default:
      return true
  }
}
