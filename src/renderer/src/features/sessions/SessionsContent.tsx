import { useDeferredValue, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectedProjectHeading } from '@renderer/features/projects/SelectedProjectHeading'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { countMatches } from './countMatches'
import { filterRows } from './filterRows'
import { groupSessionRows } from './groupSessionRows'
import { RefreshSessionsButton } from './RefreshSessionsButton'
import { SearchResultsStatus } from './SearchResultsStatus'
import { normalizeQuery } from './sessionMatches'
import { SessionSearch } from './SessionSearch'
import { SessionsBody } from './SessionsBody'
import { SessionCardList } from './SessionCardList'
import { useSessionsViewStore } from './state/useSessionsViewStore'
import { useSessions } from './useSessions'

/** Props for {@link SessionsContent}. */
interface SessionsContentProps {
  /** The folder whose sessions to show. */
  readonly dirName: string
  /** The id for the view's `h1`, which also names the list. */
  readonly headingId: string
}

/**
 * The sessions view for one folder: the project header with the search box and
 * refresh button, the live region that announces search results, and the
 * list. The search box shows only once a non-empty list has loaded, and not
 * while the folder is gone. The region
 * is mounted in every state, so its text changes while it is mounted and is
 * announced.
 *
 * @example
 * <SessionsContent dirName="-Users-me-repo" headingId={headingId} />
 */
export function SessionsContent({ dirName, headingId }: SessionsContentProps): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const { data, error, errorUpdatedAt, isFetching, refetch } = useSessions(dirName)
  const typed = useSessionsViewStore((state) => state.query)
  // Filtering waits on the deferred text, and the list is memoized, so typing stays responsive.
  const query = useDeferredValue(typed)
  const rows = useMemo(() => (data === undefined ? [] : groupSessionRows(data, t)), [data, t])
  const matching = useMemo(() => filterRows(rows, query), [rows, query])
  const matchCount = useMemo(() => countMatches(rows, query), [rows, query])
  // A gone folder's cached list is hidden behind its alert, so it isn't searchable.
  const gone = IpcCallError.codeOf(error) === 'not-found'
  const searchable = !gone && data !== undefined && data.length > 0
  // An empty or gone folder shows no search box, so a leftover query isn't a search.
  const searching = searchable && normalizeQuery(query) !== ''

  return (
    <>
      <SelectedProjectHeading
        headingId={headingId}
        actions={
          <>
            {searchable && <SessionSearch />}
            <RefreshSessionsButton key={dirName} dirName={dirName} />
          </>
        }
      />
      <SearchResultsStatus count={matchCount} searching={searching} />
      <SessionsBody
        data={data}
        error={error}
        errorUpdatedAt={errorUpdatedAt}
        isFetching={isFetching}
        onRetry={() => {
          void refetch()
        }}
        hasMatches={matching.length > 0}
      >
        <SessionCardList
          rows={matching}
          labelledBy={headingId}
          selectedDirName={dirName}
          query={normalizeQuery(query)}
        />
      </SessionsBody>
    </>
  )
}
