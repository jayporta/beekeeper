import { useRef } from 'react'
import styles from './App.module.css'
import { MainView } from '@renderer/app/MainView'
import { AboutButton } from '@renderer/features/firstRun/AboutButton'
import { useFocusOnFirstRunClose } from '@renderer/features/firstRun/state/useFocusOnFirstRunClose'
import { useFirstRunHydrated } from '@renderer/features/firstRun/state/useFirstRunHydrated'

/**
 * The app shell: a sidebar landmark beside the main content landmark. Until
 * the persisted first-run state is read it renders the empty shell, so
 * neither the first-run screen nor the main view flashes.
 *
 * @example
 * <App />
 */
function App(): React.JSX.Element {
  const hydrated = useFirstRunHydrated()
  const mainRef = useRef<HTMLElement>(null)
  const aboutRef = useRef<HTMLButtonElement>(null)
  useFocusOnFirstRunClose({ main: mainRef, about: aboutRef, hydrated })

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Sidebar">
        {hydrated && <AboutButton buttonRef={aboutRef} />}
      </aside>
      <main ref={mainRef} tabIndex={-1} className={styles.main}>
        {hydrated && <MainView />}
      </main>
    </div>
  )
}

export default App
