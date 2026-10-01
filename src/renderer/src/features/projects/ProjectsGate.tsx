import { useTranslation } from 'react-i18next'
import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { useProjects } from './useProjects'

/** Props for {@link ProjectsGate}. */
interface ProjectsGateProps {
  /** The view to show once at least one project is loaded. */
  readonly children: React.ReactNode
}

/**
 * Shows the project list's loading, empty, denied, and error states, and its
 * children once there is at least one project. Loaded data wins over a failed
 * background refresh, so a cached list stays on screen.
 *
 * @example
 * <ProjectsGate><SessionsView /></ProjectsGate>
 */
export function ProjectsGate({ children }: ProjectsGateProps): React.JSX.Element {
  const { t } = useTranslation(['projects', 'common'])
  const { data, error, isError, refetch } = useProjects()
  const retry = (): void => {
    void refetch()
  }

  if (data !== undefined) {
    if (data.length > 0) return <>{children}</>
    return <StatusMessage key="empty" heading={t('empty.heading')} body={t('empty.body')} />
  }

  // Each state has its own key, so an alert mounts fresh instead of reusing the
  // loading element, and screen readers announce it.
  if (!isError) return <StatusMessage key="loading" heading={t('loading')} role="status" />

  if (IpcCallError.codeOf(error) === 'unreadable') {
    return (
      <StatusMessage
        key="unreadable"
        heading={t('unreadable.heading')}
        role="alert"
        body={t('unreadable.body')}
      >
        <RetryButton onRetry={retry} />
      </StatusMessage>
    )
  }

  return (
    <StatusMessage key="error" heading={t('common:error.heading')} role="alert" body={t('error')}>
      <RetryButton onRetry={retry} />
    </StatusMessage>
  )
}
