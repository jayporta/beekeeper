import { FirstRunScreen } from '@renderer/features/firstRun/FirstRunScreen'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'

/**
 * The main area's current view: the first-run screen until it is dismissed
 * (or while it is reopened from About), otherwise the sessions view.
 *
 * @example
 * <main><MainView /></main>
 */
export function MainView(): React.JSX.Element {
  const showFirstRun = useFirstRunStore((state) => !state.dismissed || state.isOpen)
  if (showFirstRun) return <FirstRunScreen />
  return <h1>Sessions</h1>
}
