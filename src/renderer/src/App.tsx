import styles from './App.module.css'

/**
 * The app shell: a sidebar landmark beside the main content landmark.
 * Features fill both.
 *
 * @example
 * <App />
 */
function App(): React.JSX.Element {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="Sidebar" />
      <main className={styles.main} />
    </div>
  )
}

export default App
