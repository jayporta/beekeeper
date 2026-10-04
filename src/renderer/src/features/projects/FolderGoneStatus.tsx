import { useTranslation } from 'react-i18next'
import { projectTitle } from './projectTitle'
import { useClearGoneFolderOnNavigation } from './state/useClearGoneFolderOnNavigation'
import { useForgetUnlistedSelection } from './state/useForgetUnlistedSelection'
import { useSelectedProject } from './state/useSelectedProject'
import { useSelectedProjectStore } from './state/useSelectedProjectStore'
import { useProjects } from './useProjects'

/**
 * A polite live region that tells screen reader users when the selected
 * project's folder no longer exists and the view fell back to another project
 * (WCAG 4.1.3). It is always rendered and empty until then, so the region exists
 * before its text changes, and it stays mounted while the project gate swaps
 * between its states. It says nothing while the project list loads, and nothing
 * when the gone folder is still the project in effect, since the sessions
 * error covers that. Navigating clears it.
 *
 * @example
 * <FolderGoneStatus />
 */
export function FolderGoneStatus(): React.JSX.Element {
  const { t } = useTranslation('projects')
  const { data } = useProjects()
  const project = useSelectedProject()
  const goneDirName = useSelectedProjectStore((state) => state.goneDirName)
  useForgetUnlistedSelection()
  useClearGoneFolderOnNavigation()

  let message = ''
  if (goneDirName !== null && data !== undefined) {
    if (project === null) message = t('folderGone.none')
    else if (project.dirName !== goneDirName) {
      message = t('folderGone.showing', { project: projectTitle(project) })
    }
  }

  return (
    <p role="status" className="visuallyHidden">
      {message}
    </p>
  )
}
