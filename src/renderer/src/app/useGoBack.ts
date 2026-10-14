import { useCallback } from 'react'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import type { NavEntry } from '@renderer/features/navigation/state/navigationHistory'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { useProjects } from '@renderer/features/projects/useProjects'

/** What {@link useGoBack} returns. */
interface GoBack {
  /** Whether the history has an entry to return to. */
  readonly canGoBack: boolean
  /** Returns to the newest place that can still be shown, or does nothing when there is none. */
  readonly goBack: () => void
}

/** Whether an entry can be shown: it names no project, or a project that is still listed. */
function isShowable(entry: NavEntry, projects: readonly ProjectDto[]): boolean {
  return (
    entry.projectDirName === null ||
    projects.some((project) => project.dirName === entry.projectDirName)
  )
}

/**
 * Back for the whole app. It returns to the newest history entry whose project
 * is still listed, dropping the newer entries whose project is gone. When the
 * entry belongs to another project it selects that project too, marking the
 * change as intended so the app's reset on a project change keeps the restored
 * session. It counts as a navigation, so focus moves like it does for any
 * other. It waits, changing nothing, while the project list has not loaded.
 *
 * Call it from any control or shortcut that goes back. It lives in the app
 * shell because it ties navigation to the projects feature, which navigation
 * does not depend on.
 *
 * @returns Whether Back is possible, and the function that goes back.
 */
export function useGoBack(): GoBack {
  const canGoBack = useNavigationStore((state) => state.history.length > 0)
  const { data: projects } = useProjects()

  const goBack = useCallback(() => {
    if (projects === undefined) return
    const navigation = useNavigationStore.getState()
    let entry = navigation.popEntry()
    while (entry !== undefined && !isShowable(entry, projects)) entry = navigation.popEntry()
    if (entry === undefined) return
    const project = entry.projectDirName
    const switching = project !== null && project !== navigation.currentProjectDirName
    if (switching) navigation.markRestoringProject(project)
    navigation.restore(entry)
    if (switching) useSelectedProjectStore.getState().select(project)
  }, [projects])

  return { canGoBack, goBack }
}
