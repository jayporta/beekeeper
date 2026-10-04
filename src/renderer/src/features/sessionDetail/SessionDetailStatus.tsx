import { useTranslation } from 'react-i18next'
import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { IpcCallError } from '@renderer/ipc/ipcCallError'

/** Props for {@link SessionDetailStatus}. */
interface SessionDetailStatusProps {
  /** What the last load threw, or `null` while it is still loading. */
  readonly error: unknown
  /** Loads the session again. */
  readonly onRetry: () => void
}

/**
 * What the session detail shows while it has no data: a loading message, or
 * the reason the load failed. A session that is gone offers a way back to
 * the sessions list, and any other failure offers a retry. Each state has its
 * own key, so an alert mounts fresh and screen readers announce it. The
 * message is the whole view, so its heading is the page's `h1`.
 *
 * @example
 * <SessionDetailStatus error={error} onRetry={retry} />
 */
export function SessionDetailStatus({
  error,
  onRetry
}: SessionDetailStatusProps): React.JSX.Element {
  const { t } = useTranslation(['sessionDetail', 'common'])
  const showSessions = useNavigationStore((state) => state.showSessions)

  if (error === null) {
    return <StatusMessage key="loading" heading={t('loading')} role="status" />
  }

  switch (IpcCallError.codeOf(error)) {
    case 'not-found':
      return (
        <StatusMessage
          key="not-found"
          heading={t('notFound.heading')}
          role="alert"
          body={t('notFound.body')}
        >
          <button type="button" onClick={showSessions}>
            {t('notFound.back')}
          </button>
        </StatusMessage>
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
