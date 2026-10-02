import { useTranslation } from 'react-i18next'
import styles from './SelectedProjectHeading.module.css'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'

/** Props for {@link SelectedProjectHeading}. */
interface SelectedProjectHeadingProps {
  /** An id for the `h1`, so a table can be labelled by it. */
  readonly headingId?: string
  /** Controls shown beside the title, such as a refresh button. Kept outside the `h1`, so they don't change its name. */
  readonly actions?: React.ReactNode
}

/**
 * The sessions view's heading with the selected project's folder name, exactly
 * as on disk, as a subtitle, and optional controls beside the title.
 *
 * @example
 * <SelectedProjectHeading actions={<RefreshSessionsButton dirName={dirName} />} />
 */
export function SelectedProjectHeading({
  headingId,
  actions
}: SelectedProjectHeadingProps): React.JSX.Element {
  const { t } = useTranslation('projects')
  const dirName = useSelectedProjectDirName()

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h1 id={headingId} className={styles.title}>
          {t('heading')}
        </h1>
        {actions}
      </div>
      {dirName !== null && <p className={styles.subtitle}>{dirName}</p>}
    </header>
  )
}
