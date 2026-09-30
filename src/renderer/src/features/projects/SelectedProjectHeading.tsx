import styles from './SelectedProjectHeading.module.css'
import { useSelectedProjectDirName } from './state/useSelectedProjectDirName'

/**
 * The sessions view's heading with the selected project's folder name, exactly
 * as on disk, as a subtitle.
 *
 * @example
 * <SelectedProjectHeading />
 */
export function SelectedProjectHeading(): React.JSX.Element {
  const dirName = useSelectedProjectDirName()

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Sessions</h1>
      {dirName !== null && <p className={styles.subtitle}>{dirName}</p>}
    </header>
  )
}
