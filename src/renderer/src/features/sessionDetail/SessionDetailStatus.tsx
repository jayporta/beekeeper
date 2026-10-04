import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { NotFoundMessage } from '@renderer/components/NotFoundMessage'
import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { useFocusOrAnnounce } from '@renderer/components/useFocusOrAnnounce'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { IpcCallError } from '@renderer/ipc/ipcCallError'

/** Props for {@link SessionDetailStatus}. */
interface SessionDetailStatusProps {
  /** What the last load threw, or `null` while it is still loading. */
  readonly error: unknown
  /** When the last load failed, in milliseconds. It changes with each failed load, so a repeated `not-found` is announced again. */
  readonly errorUpdatedAt: number
  /** Whether to keep showing loading in place of a `not-found` error, while the folder's list can still say the folder is gone. */
  readonly holdNotFound: boolean
  /** Loads the session again. */
  readonly onRetry: () => void
}

/**
 * What the session detail shows while it has no data: a loading message, or
 * the reason the load failed. A session that is gone offers a way back to
 * the sessions list, and any other failure offers a retry. The loading,
 * unreadable and error states have their own keys, so an alert mounts fresh
 * and screen readers announce it. The `not-found` message is a group named by
 * its heading and described by its body, and is never a live region itself.
 * When it replaces a focused control, focus moves to it. Otherwise a separate,
 * visually hidden alert announces it, then empties out. While `holdNotFound`
 * is set, loading shows in its place. The message is the whole view, so its
 * heading is the page's `h1`.
 *
 * @example
 * <SessionDetailStatus error={error} errorUpdatedAt={at} holdNotFound={false} onRetry={retry} />
 */
export function SessionDetailStatus({
  error,
  errorUpdatedAt,
  holdNotFound,
  onRetry
}: SessionDetailStatusProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'common'])
  const showSessions = useNavigationStore((state) => state.showSessions)
  const notFoundMessage = useRef<HTMLDivElement>(null)

  const code = IpcCallError.codeOf(error)
  const gone = code === 'not-found'
  const notFoundShown = gone && !holdNotFound
  // The trigger changes with each failed load, so a repeat after Retry is announced again.
  const announceNotFound = useFocusOrAnnounce(
    notFoundMessage,
    notFoundShown ? `not-found-${errorUpdatedAt}` : ''
  )

  if (error === null || (gone && holdNotFound)) {
    return <StatusMessage key="loading" heading={t('loading')} role="status" />
  }

  switch (code) {
    case 'not-found':
      return (
        <NotFoundMessage
          heading={t('notFound.heading')}
          headingLevel={1}
          body={t('notFound.body')}
          groupRef={notFoundMessage}
          announce={announceNotFound}
        >
          <button type="button" onClick={showSessions}>
            {t('notFound.back')}
          </button>
        </NotFoundMessage>
      )
    case 'unreadable':
      return (
        <StatusMessage
          key="unreadable"
          heading={t('unreadable.heading')}
          role="alert"
          body={t('unreadable.body')}
        >
          <RetryButton onRetry={onRetry} />
        </StatusMessage>
      )
    default:
      return (
        <StatusMessage
          key="error"
          heading={t('common:error.heading')}
          role="alert"
          body={t('error')}
        >
          <RetryButton onRetry={onRetry} />
        </StatusMessage>
      )
  }
}
