import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { BackStatus } from '@renderer/features/navigation/BackStatus'
import { TitleBar } from './TitleBar'
import { TitleBarBack } from './TitleBarBack'
import { useBackShortcuts } from './useBackShortcuts'
import { useGoBack } from './useGoBack'

/** Props for {@link AppTitleBar}. */
interface AppTitleBarProps {
  /** Whether the persisted state is read. The Back button waits for it. */
  readonly hydrated: boolean
}

/**
 * The app's title bar with the Back button in it. The bar is always there; the
 * button shows only once projects are showing and the first-run screen is gone.
 * It also answers Back from the menu, the keyboard and the mouse, and holds the
 * status region that announces a press of Back that leads nowhere. Both stay
 * mounted in every state, so the region is one element across the first-run
 * close.
 *
 * @example
 * <AppTitleBar hydrated={hydrated} />
 */
export function AppTitleBar({ hydrated }: AppTitleBarProps): React.JSX.Element {
  const showFirstRun = useFirstRunStore(selectIsFirstRunShowing)
  const { canGoBack, goBack, announcement } = useGoBack()
  useBackShortcuts(goBack)
  const showBack = hydrated && !showFirstRun

  return (
    <TitleBar>
      {showBack && <TitleBarBack canGoBack={canGoBack} onBack={goBack} />}
      <BackStatus message={announcement.message} id={announcement.id} />
    </TitleBar>
  )
}
