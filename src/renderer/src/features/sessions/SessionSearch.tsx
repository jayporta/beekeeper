import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './SessionSearch.module.css'
import { useSessionsViewStore } from './state/useSessionsViewStore'

/**
 * A search box that filters the sessions list by session name. Its label is
 * visually hidden and repeated as the placeholder.
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
      <label htmlFor={inputId} className="visuallyHidden">
        {t('search.label')}
      </label>
      <input
        id={inputId}
        type="search"
        className={styles.input}
        placeholder={t('search.label')}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
      />
    </div>
  )
}
