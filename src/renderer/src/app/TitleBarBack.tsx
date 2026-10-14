import { BackButton } from '@renderer/features/navigation/BackButton'
import { hasProjectsToShow } from '@renderer/features/projects/hasProjectsToShow'
import { useProjects } from '@renderer/features/projects/useProjects'

/** Props for {@link TitleBarBack}. */
interface TitleBarBackProps {
  /** Whether there is a place to go back to. When not, the button is unavailable. */
  readonly canGoBack: boolean
  /** Goes back. It is not called while `canGoBack` is `false`. */
  readonly onBack: () => void
}

/**
 * The Back button, shown only once there are projects to show, as the views
 * are. It reads the project list, so it mounts only after the persisted state
 * is read: an earlier read would refetch a failed list before the gate shows it.
 *
 * @example
 * <TitleBarBack canGoBack={canGoBack} onBack={goBack} />
 */
export function TitleBarBack({ canGoBack, onBack }: TitleBarBackProps): React.JSX.Element | null {
  const { data: projects } = useProjects()
  if (!hasProjectsToShow(projects)) return null
  return <BackButton canGoBack={canGoBack} onBack={onBack} />
}
