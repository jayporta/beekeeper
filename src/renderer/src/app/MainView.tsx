import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { OverviewPlaceholder } from '@renderer/features/navigation/OverviewPlaceholder'
import { SessionPlaceholder } from '@renderer/features/navigation/SessionPlaceholder'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { FolderGoneStatus } from '@renderer/features/projects/FolderGoneStatus'
import { ProjectsGate } from '@renderer/features/projects/ProjectsGate'
import { useForgetUnlistedSelection } from '@renderer/features/projects/state/useForgetUnlistedSelection'
import { SessionsView } from '@renderer/features/sessions/SessionsView'
import { useResetNavigationOnProjectChange } from './useResetNavigationOnProjectChange'

/**
 * The main area's current view: the first-run screen until it is dismissed
 * (or while it is reopened from About), otherwise the view the navigation
 * store names, inside a gate that explains why there are no projects when
 * there are none. A live region beside the gate announces when the selected
 * project's folder is gone, and a stored selection the project list no longer
 * names counts as gone. It also returns navigation to the sessions list when
 * the project in effect changes.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore(selectIsFirstRunShowing)
  const view = useNavigationStore((state) => state.view)
  useResetNavigationOnProjectChange()
  useForgetUnlistedSelection()
  if (showFirstRun) return <FirstRunScreen />

  return (
    <>
      <FolderGoneStatus />
      <ProjectsGate>
        {view === 'overview' && <OverviewPlaceholder />}
        {view === 'sessions' && <SessionsView />}
        {view === 'session' && <SessionPlaceholder />}
      </ProjectsGate>
    </>
  )
}
