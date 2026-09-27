import styles from './App.module.css'

function App(): React.JSX.Element {
  return (
    <main className={styles.page}>
      <h1>Beekeeper</h1>
      <p className={styles.intro}>
        We&apos;re just getting started. Come back soon to see what your agents have been up to.
      </p>
    </main>
  )
}

export default App
