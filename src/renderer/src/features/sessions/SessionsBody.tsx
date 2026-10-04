import { useTranslation } from 'react-i18next'
import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** Props for {@link SessionsBody}. */
interface SessionsBodyProps {
  /** The folder's session list, or `undefined` until it has loaded. */
  readonly data: readonly SessionListItemDto[] | undefined
  /** What the last load threw, or `null` when it didn't fail. Once there is data, only a `not-found` error is used. */
  readonly error: unknown
  /** When the last load failed, in milliseconds. It changes with each failed load, so a repeated `not-found` mounts a new alert. */
  readonly errorUpdatedAt: number
  /** Whether a load is in flight. A `not-found` error shows loading while one is, since it is the error of the load before. */
  readonly isFetching: boolean
  /** Loads the list again. */
  readonly onRetry: () => void
  /** Whether any session matches the search. */
  readonly hasMatches: boolean
  /** The list of matching sessions, shown when there are matches. */
  readonly children: React.ReactNode
}

/**
 * What the sessions view shows for one folder: a loading, error or empty
 * state, or the list or a no-match message. Loaded data wins over a failed
 * background refresh, so a cached list stays on screen, except when the folder
 * is gone (`not-found`): its cached list is stale, so its own alert shows. Each
 * state has its own key, so an alert mounts fresh instead of reusing the
 * loading element, and screen readers announce it. The `not-found` key also
 * changes with each failed load, so a repeat after Retry is announced again.
 * While a load of that folder is in flight, its old `not-found` is not shown:
 * loading is, so a folder that came back doesn't flash the alert.
 *
 * @example
 * <SessionsBody data={data} error={null} errorUpdatedAt={0} isFetching={false} onRetry={retry} hasMatches>
 *   <SessionCardList rows={rows} labelledBy={headingId} selectedDirName="-Users-me-repo" query="" />
 * </SessionsBody>
 */
export function SessionsBody({
  data,
  error,
  errorUpdatedAt,
  isFetching,
  onRetry,
  hasMatches,
  children
}: SessionsBodyProps): React.JSX.Element {
  const { t } = useTranslation(['sessions', 'common'])

  const code = IpcCallError.codeOf(error)
  const loading = (
    <StatusMessage key="loading" heading={t('loading')} headingLevel={2} role="status" />
  )

  if (code === 'not-found') {
    if (isFetching) return loading
    return (
      <StatusMessage
        key={`not-found-${errorUpdatedAt}`}
        heading={t('notFound.heading')}
        headingLevel={2}
        role="alert"
        body={t('notFound.body')}
      >
        <RetryButton onRetry={onRetry} />
      </StatusMessage>
    )
  }

  if (data === undefined) {
    if (error === null) return loading
    if (code === 'unreadable') {
      return (
        <StatusMessage
          key="unreadable"
          heading={t('unreadable.heading')}
          headingLevel={2}
          role="alert"
          body={t('unreadable.body')}
        >
          <RetryButton onRetry={onRetry} />
        </StatusMessage>
      )
    }
    return (
      <StatusMessage
        key="error"
        heading={t('common:error.heading')}
        headingLevel={2}
        role="alert"
        body={t('error')}
      >
        <RetryButton onRetry={onRetry} />
      </StatusMessage>
    )
  }

  if (data.length === 0) {
    return (
      <StatusMessage
        key="empty"
        heading={t('emptyProject.heading')}
        headingLevel={2}
        body={t('emptyProject.body')}
      />
    )
  }

  return hasMatches ? (
    <>{children}</>
  ) : (
    <StatusMessage
      heading={t('search.noMatches')}
      headingLevel={2}
      body={t('search.noMatchesBody')}
    />
  )
}
