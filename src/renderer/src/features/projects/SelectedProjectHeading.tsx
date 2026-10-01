import { useTranslation } from 'react-i18next'
import styles from './SelectedProjectHeading.module.css'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'

/** Props for {@link SelectedProjectHeading}. */
interface SelectedProjectHeadingProps {
  /** An id for the `h1`, so a table can be labelled by it. */
  readonly headingId?: string
}

/**
 * The sessions view's heading with the selected project's folder name, exactly
 * as on disk, as a subtitle.
 *
 * @example
 * <SelectedProjectHeading />
 */
export function SelectedProjectHeading({
  headingId
}: SelectedProjectHeadingProps): React.JSX.Element {
  const { t } = useTranslation('projects')
  const dirName = useSelectedProjectDirName()

  return (
    <header className={styles.header}>
      <h1 id={headingId} className={styles.title}>
        {t('heading')}
      </h1>
      {dirName !== null && <p className={styles.subtitle}>{dirName}</p>}
    </header>
  )
}
