import { useId } from 'react'
import styles from './SessionSearch.module.css'
import { useSessionsViewStore } from './state/useSessionsViewStore'

/**
 * A labeled search box that filters the sessions table by session name.
 *
 * @example
 * <SessionSearch />
 */
export function SessionSearch(): React.JSX.Element {
  const query = useSessionsViewStore((state) => state.query)
  const setQuery = useSessionsViewStore((state) => state.setQuery)
  const inputId = useId()

  return (
    <div className={styles.search}>
      <label htmlFor={inputId} className={styles.label}>
        Search sessions
      </label>
      <input
        id={inputId}
        type="search"
        className={styles.input}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
      />
    </div>
  )
}
