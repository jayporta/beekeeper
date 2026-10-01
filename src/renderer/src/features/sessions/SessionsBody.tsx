import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { SessionSearch } from './SessionSearch'
import type { SessionRow } from './sessionRow'
import { SessionsTable } from './SessionsTable'

/** Props for {@link SessionsBody}. */
interface SessionsBodyProps {
  /** The folder's session list, or `undefined` until it has loaded. */
  readonly data: readonly SessionListItemDto[] | undefined
  /** Whether the last load failed. Ignored once there is data. */
  readonly isError: boolean
  /** Loads the list again. */
  readonly onRetry: () => void
  /** The rows that match the search. */
  readonly matching: readonly SessionRow[]
  /** Whether a search is active. */
  readonly searching: boolean
  /** The folder whose sessions are shown. */
  readonly dirName: string
  /** The id of the heading that names the table. */
  readonly headingId: string
}

/**
 * What the sessions view shows for one folder: a loading, error or empty
 * state, or the search box with the table or a no-match message. Loaded data
 * wins over a failed background refresh, so a cached list stays on screen.
 *
 * @example
 * <SessionsBody data={data} isError={false} onRetry={retry} matching={rows} searching={false} dirName="-Users-me-repo" headingId={headingId} />
 */
export function SessionsBody({
  data,
  isError,
  onRetry,
  matching,
  searching,
  dirName,
  headingId
}: SessionsBodyProps): React.JSX.Element {
  if (data === undefined) {
    if (!isError) return <StatusMessage heading="Loading sessions" headingLevel={2} role="status" />
    return (
      <StatusMessage
        heading="Something went wrong"
        headingLevel={2}
        role="alert"
        body="Beekeeper couldn't load this project's sessions."
      >
        <RetryButton onRetry={onRetry} />
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
          searching={searching}
        />
      )}
    </>
  )
}
