import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { SessionSearch } from './SessionSearch'

/** Props for {@link SessionsBody}. */
interface SessionsBodyProps {
  /** The folder's session list, or `undefined` until it has loaded. */
  readonly data: readonly SessionListItemDto[] | undefined
  /** What the last load threw, or `null` when it didn't fail. Ignored once there is data. */
  readonly error: unknown
  /** Loads the list again. */
  readonly onRetry: () => void
  /** Whether any session matches the search. */
  readonly hasMatches: boolean
  /** The table of matching sessions, shown when there are matches. */
  readonly children: React.ReactNode
}

/**
 * What the sessions view shows for one folder: a loading, error or empty
 * state, or the search box with the table or a no-match message. Loaded data
 * wins over a failed background refresh, so a cached list stays on screen.
 * Each state has its own key, so an alert mounts fresh instead of reusing the
 * loading element, and screen readers announce it.
 *
 * @example
 * <SessionsBody data={data} error={null} onRetry={retry} hasMatches>
 *   <SessionsTable rows={rows} labelledBy={headingId} selectedDirName="-Users-me-repo" searching={false} />
 * </SessionsBody>
 */
export function SessionsBody({
  data,
  error,
  onRetry,
  hasMatches,
  children
}: SessionsBodyProps): React.JSX.Element {
  if (data === undefined) {
    const code = IpcCallError.codeOf(error)
    if (error === null) {
      return (
        <StatusMessage key="loading" heading="Loading sessions" headingLevel={2} role="status" />
      )
    }
    if (code === 'unreadable') {
      return (
        <StatusMessage
          key="unreadable"
          heading="Can't read this project's sessions"
          headingLevel={2}
          role="alert"
          body="Beekeeper can't read this project's folder. Check its permissions, then retry."
        >
          <RetryButton onRetry={onRetry} />
        </StatusMessage>
      )
    }
    return (
      <StatusMessage
        key="error"
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
        key="empty"
        heading="No sessions in this project"
        headingLevel={2}
        body="Sessions appear here after you run Claude Code in this folder."
      />
    )
  }

  return (
    <>
      <SessionSearch />
      {hasMatches ? (
        children
      ) : (
        <StatusMessage
          heading="No matching sessions"
          headingLevel={2}
          body="Try a different search."
        />
      )}
    </>
  )
}
