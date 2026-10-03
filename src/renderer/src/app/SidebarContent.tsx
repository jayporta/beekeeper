import { useTranslation } from 'react-i18next'
import { AboutButton } from '@renderer/features/firstRun/AboutButton'
import { ProjectList } from '@renderer/features/projects/ProjectList'
import styles from './SidebarContent.module.css'

/** Props for {@link SidebarContent}. */
interface SidebarContentProps {
  /** A ref to the About button, so focus can return to it when the screen it opened closes. */
  readonly aboutRef: React.Ref<HTMLButtonElement>
}

/**
 * What the sidebar holds: the app name, the project list once projects are
 * loaded, and a footer with the About control and the local-only note.
 *
 * @example
 * <aside aria-label="Sidebar"><SidebarContent aboutRef={aboutRef} /></aside>
 */
export function SidebarContent({ aboutRef }: SidebarContentProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className={styles.content}>
      <p className={styles.name}>{t('appName')}</p>
      <ProjectList />
      <div className={styles.footer}>
        <AboutButton buttonRef={aboutRef} />
        <p className={styles.note}>{t('localOnly')}</p>
      </div>
    </div>
  )
}
