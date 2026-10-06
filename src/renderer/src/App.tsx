import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './App.module.css'
import { AboutDialog } from '@renderer/features/about/AboutDialog'
import { MainView } from '@renderer/app/MainView'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { SidebarContent } from '@renderer/app/SidebarContent'
import { SkipLink } from '@renderer/app/SkipLink'
import { useFocusMainOnNavigate } from '@renderer/app/useFocusMainOnNavigate'
import { useFocusOnFirstRunClose } from '@renderer/features/firstRun/state/useFocusOnFirstRunClose'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { usePersistHydrated } from '@renderer/storage/usePersistHydrated'

/**
 * The app shell: a skip link, a sidebar landmark beside the main content
 * landmark, and focus moves to main when the person navigates. Until
 * the persisted state is read it renders the empty shell, so neither the
 * first-run screen nor the main view flashes. The About dialog is mounted
 * outside that wait, so the menu can open it at any time.
 *
 * @example
 * <App />
 */
function App(): React.JSX.Element {
  const { t } = useTranslation()
  const firstRunHydrated = usePersistHydrated(useFirstRunStore.persist)
  const selectionHydrated = usePersistHydrated(useSelectedProjectStore.persist)
  const hydrated = firstRunHydrated && selectionHydrated
  const mainRef = useRef<HTMLElement>(null)
  useFocusOnFirstRunClose({ main: mainRef, hydrated })
  useFocusMainOnNavigate(mainRef)

  return (
    <div className={styles.shell}>
      <SkipLink target={mainRef} />
      <aside className={styles.sidebar} aria-label={t('sidebar')}>
        {hydrated && <SidebarContent />}
      </aside>
      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        aria-labelledby={MAIN_HEADING_ID}
        className={styles.main}
      >
        {hydrated && <MainView />}
      </main>
      <AboutDialog />
    </div>
  )
}

export default App
