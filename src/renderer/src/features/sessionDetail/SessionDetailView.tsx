import { useState } from 'react'
import { isProjectChange } from '@renderer/features/navigation/isProjectChange'
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
 * It also renders nothing once the project in effect changes to another one it
 * did not open under, as when the project's folder is gone and another project
 * takes over, so the session of the old project never shows under the new one.
 * It relies on `useResetNavigationOnProjectChange`, which follows the same
 * `isProjectChange` rule, to return navigation to the sessions list: without
 * it the view would stay blank.
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
  if (isProjectChange(openedUnder, dirName)) return null

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
