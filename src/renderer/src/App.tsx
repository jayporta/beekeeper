import styles from './App.module.css'
import { MainView } from './app/MainView'
import { AboutButton } from './features/firstRun/AboutButton'
import { useFirstRunHydrated } from './features/firstRun/state/useFirstRunHydrated'

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

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Sidebar">
        {hydrated && <AboutButton />}
      </aside>
      <main className={styles.main}>{hydrated && <MainView />}</main>
    </div>
  )
}

export default App
