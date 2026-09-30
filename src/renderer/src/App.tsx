import { useRef } from 'react'
import styles from './App.module.css'
import { MainView } from '@renderer/app/MainView'
import { SidebarContent } from '@renderer/app/SidebarContent'
import { useFocusOnFirstRunClose } from '@renderer/features/firstRun/state/useFocusOnFirstRunClose'
import { useFirstRunStore } from '@renderer/features/firstRun/state/useFirstRunStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { usePersistHydrated } from '@renderer/storage/usePersistHydrated'

/**
 * The app shell: a sidebar landmark beside the main content landmark. Until
 * the persisted state is read it renders the empty shell, so neither the
 * first-run screen nor the main view flashes.
 *
 * @example
 * <App />
 */
function App(): React.JSX.Element {
  const firstRunHydrated = usePersistHydrated(useFirstRunStore.persist)
  const selectionHydrated = usePersistHydrated(useSelectedProjectStore.persist)
  const hydrated = firstRunHydrated && selectionHydrated
  const mainRef = useRef<HTMLElement>(null)
  const aboutRef = useRef<HTMLButtonElement>(null)
  useFocusOnFirstRunClose({ main: mainRef, about: aboutRef, hydrated })

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Sidebar">
        {hydrated && <SidebarContent aboutRef={aboutRef} />}
      </aside>
      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        {hydrated && <MainView />}
      </main>
    </div>
  )
}

export default App
