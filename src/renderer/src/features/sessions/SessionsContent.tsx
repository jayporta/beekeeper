import { useDeferredValue, useEffect, useMemo } from 'react'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { countMatches } from './countMatches'
import { filterRows } from './filterRows'
import { groupSessionRows } from './groupSessionRows'
import { SearchResultsStatus } from './SearchResultsStatus'
import { SessionSearch } from './SessionSearch'
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
 * The body of the sessions view for one folder: its loading, error, empty and
 * no-match states, or the search box and table. Loaded data wins over a failed
 * background refresh, so a cached list stays on screen.
 *
 * @example
 * <SessionsContent dirName="-Users-me-repo" headingId={headingId} />
 */
export function SessionsContent({ dirName, headingId }: SessionsContentProps): React.JSX.Element {
  const { data, isError, refetch } = useSessions(dirName)
  const typed = useSessionsViewStore((state) => state.query)
  // Filtering waits on the deferred text, so typing in the box stays responsive.
  const query = useDeferredValue(typed)
  const collapseAll = useSessionsViewStore((state) => state.collapseAll)
  const rows = useMemo(() => (data === undefined ? [] : groupSessionRows(data)), [data])
  const matching = useMemo(() => filterRows(rows, query), [rows, query])
  const matchCount = useMemo(() => countMatches(rows, query), [rows, query])

  // Expansion is keyed by session, so another folder's sessions are never expanded.
  useEffect(() => {
    collapseAll()
  }, [dirName, collapseAll])

  if (data === undefined) {
    if (!isError) return <StatusMessage heading="Loading sessions" headingLevel={2} role="status" />
    return (
      <StatusMessage
        heading="Something went wrong"
        headingLevel={2}
        role="alert"
        body="Beekeeper couldn't load this project's sessions."
      >
        <button
          type="button"
          onClick={() => {
            void refetch()
          }}
        >
          Retry
        </button>
      </StatusMessage>
    )
  }

  if (data.length === 0) {
    return (
      <StatusMessage
        heading="No sessions in this project"
        headingLevel={2}
        body="Sessions appear here after you run Claude Code in this folder."
      />
    )
  }

  return (
    <>
      <SessionSearch />
      <SearchResultsStatus count={matchCount} searching={query.trim() !== ''} />
      {matching.length === 0 ? (
        <StatusMessage
          heading="No matching sessions"
          headingLevel={2}
          body="Try a different search."
        />
      ) : (
        <SessionsTable
          rows={matching}
          labelledBy={headingId}
          selectedDirName={dirName}
          searching={query.trim() !== ''}
        />
      )}
    </>
  )
}
