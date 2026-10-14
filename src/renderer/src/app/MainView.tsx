import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { LiveUpdates } from '@renderer/features/liveUpdates/LiveUpdates'
import { BackButton } from '@renderer/features/navigation/BackButton'
import { BackStatus } from '@renderer/features/navigation/BackStatus'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { OverviewView } from '@renderer/features/overview/OverviewView'
import { FolderGoneStatus } from '@renderer/features/projects/FolderGoneStatus'
import { ProjectsGate } from '@renderer/features/projects/ProjectsGate'
import { useForgetUnlistedSelection } from '@renderer/features/projects/state/useForgetUnlistedSelection'
import { SessionDetailView } from '@renderer/features/sessionDetail/SessionDetailView'
import { SessionsView } from '@renderer/features/sessions/SessionsView'
import { useBackShortcuts } from './useBackShortcuts'
import { useGoBack } from './useGoBack'
import { useResetNavigationOnProjectChange } from './useResetNavigationOnProjectChange'

/**
 * The main area's current view: the first-run screen until it is dismissed,
 * otherwise the view the navigation
 * store names, inside a gate that explains why there are no projects when
 * there are none. A live region beside the gate announces when the selected
 * project's folder is gone, and a stored selection the project list no longer
 * names counts as gone. The region is the first child in every branch, so it
 * stays the same element when the first-run screen closes and its text is
 * announced. A second region, in the same place in every branch, announces a
 * press of Back that leads nowhere. It also returns navigation to the sessions
 * list when the project in effect changes. Above every view, inside the gate,
 * it shows the Back button, and it answers Back from the menu, the keyboard and
 * the mouse. Beside the views it mounts live updates, so they start only once the
 * persisted state is read.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore(selectIsFirstRunShowing)
  const view = useNavigationStore((state) => state.view)
  useResetNavigationOnProjectChange()
  useForgetUnlistedSelection()
  const { canGoBack, goBack, announcement } = useGoBack()
  useBackShortcuts(goBack)
  const backStatus = <BackStatus message={announcement.message} id={announcement.id} />
  if (showFirstRun) {
    return (
      <>
        <FolderGoneStatus />
        {backStatus}
        <FirstRunScreen />
      </>
    )
  }

  return (
    <>
      <FolderGoneStatus />
      {backStatus}
      <LiveUpdates />
      <ProjectsGate>
        <BackButton canGoBack={canGoBack} onBack={goBack} />
        {view === 'overview' && <OverviewView />}
        {view === 'sessions' && <SessionsView />}
        {view === 'session' && <SessionDetailView />}
      </ProjectsGate>
    </>
  )
}
