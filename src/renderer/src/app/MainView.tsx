import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { OverviewPlaceholder } from '@renderer/features/navigation/OverviewPlaceholder'
import { SessionPlaceholder } from '@renderer/features/navigation/SessionPlaceholder'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useResetNavigationOnProjectChange } from '@renderer/features/navigation/state/useResetNavigationOnProjectChange'
import { ProjectsGate } from '@renderer/features/projects/ProjectsGate'
import { SessionsView } from '@renderer/features/sessions/SessionsView'

/**
 * The main area's current view: the first-run screen until it is dismissed
 * (or while it is reopened from About), otherwise the view the navigation
 * store names, inside a gate that explains why there are no projects when
 * there are none. It also returns navigation to the sessions list when the
 * project in effect changes.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore(selectIsFirstRunShowing)
  const view = useNavigationStore((state) => state.view)
  useResetNavigationOnProjectChange()
  if (showFirstRun) return <FirstRunScreen />

  return (
    <ProjectsGate>
      {view === 'overview' && <OverviewPlaceholder />}
      {view === 'sessions' && <SessionsView />}
      {view === 'session' && <SessionPlaceholder />}
    </ProjectsGate>
  )
}
