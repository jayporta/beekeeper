import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './App.module.css'
import { AboutDialog } from '@renderer/features/about/AboutDialog'
import { MainView } from '@renderer/app/MainView'
import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { SidebarContent } from '@renderer/app/SidebarContent'
import { SidebarResizer } from '@renderer/app/SidebarResizer'
import { SIDEBAR_ID } from '@renderer/app/sidebarId'
import { SkipLink } from '@renderer/app/SkipLink'
import { useFocusMainOnNavigate } from '@renderer/app/useFocusMainOnNavigate'
import { useSidebarWidth } from '@renderer/app/useSidebarWidth'
import { useSidebarWidthStore } from '@renderer/app/state/useSidebarWidthStore'
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
  const widthHydrated = usePersistHydrated(useSidebarWidthStore.persist)
  const hydrated = firstRunHydrated && selectionHydrated && widthHydrated
  const sidebar = useSidebarWidth()
  const mainRef = useRef<HTMLElement>(null)
  useFocusOnFirstRunClose({ main: mainRef, hydrated })
  useFocusMainOnNavigate(mainRef)

  return (
    // The one inline style: a class can't carry the runtime width, so it goes in a custom property
    // that the stylesheet reads. React sets it through the CSSOM, which the CSP allows.
    <div
      className={styles.shell}
      style={{ '--size-sidebar-current': `${sidebar.width}px` } as React.CSSProperties}
    >
      <SkipLink target={mainRef} />
      <aside id={SIDEBAR_ID} className={styles.sidebar} aria-label={t('sidebar')}>
        {hydrated && <SidebarContent />}
        <SidebarResizer
          width={sidebar.width}
          min={sidebar.min}
          max={sidebar.max}
          onPreview={sidebar.preview}
          onCommit={sidebar.commit}
        />
      </aside>
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
      <AboutDialog />
    </div>
  )
}

export default App
