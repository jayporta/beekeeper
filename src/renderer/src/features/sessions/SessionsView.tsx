import { MAIN_HEADING_ID } from '@renderer/components/mainHeading'
import { SelectedProjectHeading } from '@renderer/features/projects/SelectedProjectHeading'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { RefreshSessionsButton } from './RefreshSessionsButton'
import { SessionsContent } from './SessionsContent'
import styles from './SessionsView.module.css'

/**
 * The sessions view for the selected project: a heading naming the folder
 * with a refresh button, a search box, and the sessions table.
 *
 * @example
 * <SessionsView />
 */
export function SessionsView(): React.JSX.Element {
  const dirName = useSelectedProjectDirName()

  return (
    <div className={styles.view}>
      <SelectedProjectHeading
        headingId={MAIN_HEADING_ID}
        actions={dirName !== null && <RefreshSessionsButton key={dirName} dirName={dirName} />}
      />
      {dirName !== null && <SessionsContent dirName={dirName} headingId={MAIN_HEADING_ID} />}
    </div>
  )
}
