import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SessionSearch.module.css'
import { useSessionsViewStore } from './state/useSessionsViewStore'

/**
 * A labeled search box that filters the sessions table by session name.
 *
 * @example
 * <SessionSearch />
 */
export function SessionSearch(): React.JSX.Element {
  const { t } = useTranslation('sessions')
  const query = useSessionsViewStore((state) => state.query)
  const setQuery = useSessionsViewStore((state) => state.setQuery)
  const inputId = useId()

  return (
    <div className={styles.search}>
      <label htmlFor={inputId} className={styles.label}>
        {t('search.label')}
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
