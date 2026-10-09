import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { LiveUpdates } from '@renderer/features/liveUpdates/LiveUpdates'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { OverviewView } from '@renderer/features/overview/OverviewView'
import { FolderGoneStatus } from '@renderer/features/projects/FolderGoneStatus'
import { ProjectsGate } from '@renderer/features/projects/ProjectsGate'
import { useForgetUnlistedSelection } from '@renderer/features/projects/state/useForgetUnlistedSelection'
import { SessionDetailView } from '@renderer/features/sessionDetail/SessionDetailView'
import { SessionsView } from '@renderer/features/sessions/SessionsView'
import { useResetNavigationOnProjectChange } from './useResetNavigationOnProjectChange'

/**
 * The main area's current view: the first-run screen until it is dismissed,
 * otherwise the view the navigation
 * store names, inside a gate that explains why there are no projects when
 * there are none. A live region beside the gate announces when the selected
 * project's folder is gone, and a stored selection the project list no longer
 * names counts as gone. The region is the first child in every branch, so it
 * stays the same element when the first-run screen closes and its text is
 * announced. It also returns navigation to the sessions list when
 * the project in effect changes. Beside the views it mounts live updates, so
 * they start only once the persisted state is read.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore(selectIsFirstRunShowing)
  const view = useNavigationStore((state) => state.view)
  useResetNavigationOnProjectChange()
  useForgetUnlistedSelection()
  if (showFirstRun) {
    return (
      <>
        <FolderGoneStatus />
        <FirstRunScreen />
      </>
    )
  }

  return (
    <>
      <FolderGoneStatus />
      <LiveUpdates />
      <ProjectsGate>
        {view === 'overview' && <OverviewView />}
        {view === 'sessions' && <SessionsView />}
        {view === 'session' && <SessionDetailView />}
      </ProjectsGate>
    </>
  )
}
