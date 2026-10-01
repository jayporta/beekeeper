import { useDeferredValue, useMemo } from 'react'
import { countMatches } from './countMatches'
import { filterRows } from './filterRows'
import { groupSessionRows } from './groupSessionRows'
import { SearchResultsStatus } from './SearchResultsStatus'
import { normalizeQuery } from './sessionMatches'
import { SessionsBody } from './SessionsBody'
import { SessionsTable } from './SessionsTable'
import { useSessionsViewStore } from './state/useSessionsViewStore'
import { useSessions } from './useSessions'

/** Props for {@link SessionsContent}. */
interface SessionsContentProps {
  /** The folder whose sessions to show. */
  readonly dirName: string
  /** The id of the heading that names the table. */
  readonly headingId: string
}

/**
 * The body of the sessions view for one folder, with the live region that
 * announces search results. The region is mounted in every state, so its text
 * changes while it is mounted and is announced.
 *
 * @example
 * <SessionsContent dirName="-Users-me-repo" headingId={headingId} />
 */
export function SessionsContent({ dirName, headingId }: SessionsContentProps): React.JSX.Element {
  const { data, error, refetch } = useSessions(dirName)
  const typed = useSessionsViewStore((state) => state.query)
  // Filtering waits on the deferred text, and the table is memoized, so typing stays responsive.
  const query = useDeferredValue(typed)
  const rows = useMemo(() => (data === undefined ? [] : groupSessionRows(data)), [data])
  const matching = useMemo(() => filterRows(rows, query), [rows, query])
  const matchCount = useMemo(() => countMatches(rows, query), [rows, query])
  // An empty folder shows no search box, so a leftover query isn't a search.
  const searching = data !== undefined && data.length > 0 && normalizeQuery(query) !== ''

  return (
    <>
      <SearchResultsStatus count={matchCount} searching={searching} />
      <SessionsBody
        data={data}
        error={error}
        onRetry={() => {
          void refetch()
        }}
        hasMatches={matching.length > 0}
      >
        <SessionsTable
          rows={matching}
          labelledBy={headingId}
          selectedDirName={dirName}
          searching={searching}
        />
      </SessionsBody>
    </>
  )
}
