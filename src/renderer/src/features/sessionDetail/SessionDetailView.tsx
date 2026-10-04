import { useState } from 'react'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { SessionDetailContent } from './SessionDetailContent'
import styles from './SessionDetailView.module.css'

/**
 * The single-session view: the session the navigation store names, read with
 * the selected project's sessions list. Each session mounts its own content, so
 * nothing carries over from the one before. It renders nothing without a selected
 * session or project, neither of which the projects gate lets this view reach.
 * It also renders nothing once the project in effect is not the one it opened
 * under, as when the project's folder is gone and another project takes over:
 * the session belongs to the old project, and navigation is about to leave the
 * view. The first project to load, and any gap while projects are unavailable,
 * are not changes, as for that reset.
 *
 * @example
 * <SessionDetailView />
 */
export function SessionDetailView(): React.JSX.Element | null {
  const sessionRef = useNavigationStore((state) => state.selectedSessionRef)
  const dirName = useSelectedProjectDirName()
  const [openedUnder, setOpenedUnder] = useState<string | null>(null)
  if (openedUnder === null && dirName !== null) setOpenedUnder(dirName)

  if (sessionRef === null || dirName === null) return null
  if (openedUnder !== null && openedUnder !== dirName) return null

  return (
    <div className={styles.view}>
      <SessionDetailContent
        key={sessionKey(sessionRef)}
        sessionRef={sessionRef}
        dirName={dirName}
      />
    </div>
  )
}
