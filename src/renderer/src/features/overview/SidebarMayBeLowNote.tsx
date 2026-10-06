import { useTranslation } from 'react-i18next'
import styles from './SidebarMayBeLowNote.module.css'

/**
 * The note under the sidebar's project list that says what the "~" on a
 * figure means. Each marked row already says "may be low" to assistive
 * technology, so the note is hidden from it.
 *
 * @example
 * {showsMayBeLow(overall) && <SidebarMayBeLowNote />}
 */
export function SidebarMayBeLowNote(): React.JSX.Element {
  const { t } = useTranslation('overview')

  return (
    <p className={styles.note} aria-hidden="true">
      {t('sidebar.mayBeLowNote', { marker: t('sidebar.mayBeLowMarker') })}
    </p>
  )
}
