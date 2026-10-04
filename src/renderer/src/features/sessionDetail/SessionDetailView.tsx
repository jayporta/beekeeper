import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { SessionDetailContent } from './SessionDetailContent'
import styles from './SessionDetailView.module.css'

/**
 * The single-session view: the session the navigation store names, read with
 * the selected project's sessions list. It renders nothing without a selected
 * session or project, neither of which the projects gate lets this view reach.
 *
 * @example
 * <SessionDetailView />
 */
export function SessionDetailView(): React.JSX.Element | null {
  const sessionRef = useNavigationStore((state) => state.selectedSessionRef)
  const dirName = useSelectedProjectDirName()
  if (sessionRef === null || dirName === null) return null

  return (
    <div className={styles.view}>
      <SessionDetailContent sessionRef={sessionRef} dirName={dirName} />
    </div>
  )
}
