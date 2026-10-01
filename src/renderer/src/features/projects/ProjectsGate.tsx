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
  const { data, error, isError, refetch } = useProjects()
  const retry = (): void => {
    void refetch()
  }

  if (data !== undefined) {
    if (data.length > 0) return <>{children}</>
    return (
      <StatusMessage
        key="empty"
        heading="No sessions found"
        body="Beekeeper found no Claude Code sessions under ~/.claude/projects. Sessions appear here after you run Claude Code in a project."
      />
    )
  }

  // Each state has its own key, so an alert mounts fresh instead of reusing the
  // loading element, and screen readers announce it.
  if (!isError) return <StatusMessage key="loading" heading="Loading projects" role="status" />

  if (IpcCallError.codeOf(error) === 'unreadable') {
    return (
      <StatusMessage
        key="unreadable"
        heading="Can't read your sessions"
        role="alert"
        body="Beekeeper can't read ~/.claude/projects. Check that folder's permissions. On macOS, also check whether Beekeeper was denied access to it. Then retry."
      >
        <RetryButton onRetry={retry} />
      </StatusMessage>
    )
  }

  return (
    <StatusMessage
      key="error"
      heading="Something went wrong"
      role="alert"
      body="Beekeeper couldn't load your projects."
    >
      <RetryButton onRetry={retry} />
    </StatusMessage>
  )
}
