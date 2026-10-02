import { useTranslation } from 'react-i18next'
import { RetryButton } from '@renderer/components/RetryButton'
import { StatusMessage } from '@renderer/components/StatusMessage'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { hasProjectsToShow } from './hasProjectsToShow'
import { useProjects } from './useProjects'

/** Props for {@link ProjectsGate}. */
interface ProjectsGateProps {
  /** The view to show once at least one project is loaded. */
  readonly children: React.ReactNode
}

/**
 * Shows the project list's loading, empty, denied, and error states, and its
 * children once there is at least one project. A non-empty loaded list wins
 * over a failed background refresh, so it stays on screen. An empty list does
 * not: if its refresh fails, the error state shows instead of the empty one,
 * and loading shows again while it refetches.
 *
 * @example
 * <ProjectsGate><SessionsView /></ProjectsGate>
 */
export function ProjectsGate({ children }: ProjectsGateProps): React.JSX.Element {
  const { t } = useTranslation(['projects', 'common'])
  const { data, error, isError, isFetching, refetch } = useProjects()
  const retry = (): void => {
    void refetch()
  }

  if (hasProjectsToShow(data)) return <>{children}</>
  if (data !== undefined && !isError) {
    return <StatusMessage key="empty" heading={t('empty.heading')} body={t('empty.body')} />
  }

  // Each state has its own key, so an alert mounts fresh instead of reusing the
  // loading element, and screen readers announce it. An empty list whose refresh
  // failed shows loading while it refetches, since the query keeps its error
  // status then, so the next failure mounts a new alert.
  if (!isError || isFetching)
    return <StatusMessage key="loading" heading={t('loading')} role="status" />

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
