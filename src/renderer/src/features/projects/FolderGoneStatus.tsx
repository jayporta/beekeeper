import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useFocusOrAnnounce } from '@renderer/components/useFocusOrAnnounce'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import styles from './FolderGoneStatus.module.css'
import { projectTitle } from './projectTitle'
import { useClearGoneFolderOnNavigation } from './state/useClearGoneFolderOnNavigation'
import { useSelectedProject } from './state/useSelectedProject'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'
import { useProjects } from './useProjects'

/**
 * A notice that tells people when the selected project's folder no longer
 * exists and the view fell back to another project (WCAG 4.1.3). It is a
 * visible paragraph for sighted people, plus a separate, visually hidden status
 * region that announces it. The region is always rendered and empty until then,
 * so it exists before its text changes, and it stays mounted while the project
 * gate swaps between its states. The notice names the gone folder, and the
 * project that took over when one did. It says nothing while the project list
 * loads, and nothing when the gone folder is still the project in effect, since
 * the sessions error covers that. On the overview no project took over, so it
 * names only the folder. When the change removes the focused element, focus
 * moves to the visible notice and the region stays empty, so it isn't read
 * twice. Otherwise the region announces it. Navigating clears it.
 *
 * @example
 * <FolderGoneStatus />
 */
export function FolderGoneStatus(): React.JSX.Element {
  const { t } = useTranslation('projects')
  const { data } = useProjects()
  const project = useSelectedProject()
  const isOverview = useNavigationStore((state) => state.view === 'overview')
  const goneDirName = useSelectedProjectStore((state) => state.goneDirName)
  const region = useRef<HTMLParagraphElement>(null)
  useClearGoneFolderOnNavigation()

  let message = ''
  if (goneDirName !== null && data !== undefined) {
    if (isOverview || project === null) {
      message = t('folderGone.gone', { folder: goneDirName })
    } else if (project.dirName !== goneDirName) {
      message = t('folderGone.showing', { folder: goneDirName, project: projectTitle(project) })
    }
  }

  const announce = useFocusOrAnnounce(region, message)

  return (
    <>
      <p ref={region} tabIndex={-1} className={styles.notice}>
        {message}
      </p>
      <p role="status" className="visuallyHidden">
        {announce ? message : ''}
      </p>
    </>
  )
}
