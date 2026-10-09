import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { SelectedProjectHeading } from '@renderer/features/projects/SelectedProjectHeading'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { SessionsContent } from './SessionsContent'
import styles from './SessionsView.module.css'

/**
 * The sessions view for the selected project: a header with the breadcrumb,
 * project name, search box and refresh button, then the sessions list. With no
 * project in effect it shows only the heading.
 *
 * @example
 * <SessionsView />
 */
export function SessionsView(): React.JSX.Element {
  const dirName = useSelectedProjectDirName()

  return (
    <div className={styles.view}>
      {dirName === null ? (
        <SelectedProjectHeading headingId={MAIN_HEADING_ID} />
      ) : (
        <SessionsContent key={dirName} dirName={dirName} headingId={MAIN_HEADING_ID} />
      )}
    </div>
  )
}
