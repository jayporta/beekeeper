import { useRef } from 'react'
import styles from './App.module.css'
import { AboutDialog } from '@renderer/features/about/AboutDialog'
import { AppTitleBar } from '@renderer/app/AppTitleBar'
import { MainView } from '@renderer/app/MainView'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { SidebarContent } from '@renderer/app/SidebarContent'
import { ResizableShell } from '@renderer/app/ResizableShell'
import { SkipLink } from '@renderer/app/SkipLink'
import { useFocusMainOnNavigate } from '@renderer/app/useFocusMainOnNavigate'
import { useSidebarWidthStore } from '@renderer/app/state/useSidebarWidthStore'
import { useFocusOnFirstRunClose } from '@renderer/features/firstRun/state/useFocusOnFirstRunClose'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { usePersistHydrated } from '@renderer/storage/usePersistHydrated'

/**
 * The app shell: a skip link, a title bar with Back, a sidebar landmark beside the main content
 * landmark, and focus moves to main when the person navigates. Until
 * the persisted state is read it renders the empty shell, so neither the
 * first-run screen nor the main view flashes. The About dialog is mounted
 * outside that wait, so the menu can open it at any time.
 *
 * @example
 * <App />
 */
function App(): React.JSX.Element {
  const firstRunHydrated = usePersistHydrated(useFirstRunStore.persist)
  const selectionHydrated = usePersistHydrated(useSelectedProjectStore.persist)
  const widthHydrated = usePersistHydrated(useSidebarWidthStore.persist)
  const hydrated = firstRunHydrated && selectionHydrated && widthHydrated
  const mainRef = useRef<HTMLElement>(null)
  useFocusOnFirstRunClose({ main: mainRef, hydrated })
  useFocusMainOnNavigate(mainRef)

  return (
    <ResizableShell
      skipLink={<SkipLink target={mainRef} />}
      titleBar={<AppTitleBar hydrated={hydrated} />}
      sidebar={hydrated && <SidebarContent />}
      main={
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          aria-labelledby={MAIN_HEADING_ID}
          className={styles.main}
        >
          {hydrated && (
            <div className={styles.content}>
              <MainView />
            </div>
          )}
        </main>
      }
    >
      <AboutDialog />
    </ResizableShell>
  )
}

export default App
