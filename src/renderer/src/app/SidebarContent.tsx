import { useTranslation } from 'react-i18next'
import { ProjectList } from '@renderer/features/projects/ProjectList'
import styles from './SidebarContent.module.css'

/**
 * What the sidebar holds: the app name, the project list once projects are
 * loaded, and a footer with the local-only note.
 *
 * @example
 * <aside aria-label="Sidebar"><SidebarContent /></aside>
 */
export function SidebarContent(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className={styles.content}>
      <p className={styles.name}>{t('appName')}</p>
      <ProjectList />
      <div className={styles.footer}>
        <p className={styles.note}>{t('localOnly')}</p>
      </div>
    </div>
  )
}
