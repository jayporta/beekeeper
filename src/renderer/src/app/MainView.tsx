import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { ProjectsGate } from '@renderer/features/projects/ProjectsGate'
import { SessionsView } from '@renderer/features/sessions/SessionsView'

/**
 * The main area's current view: the first-run screen until it is dismissed
 * (or while it is reopened from About), otherwise the sessions view, which
 * explains why there are no projects when there are none.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore(selectIsFirstRunShowing)
  if (showFirstRun) return <FirstRunScreen />

  return (
    <ProjectsGate>
      <SessionsView />
    </ProjectsGate>
  )
}
