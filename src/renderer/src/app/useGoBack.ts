import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import { entryOf } from '@renderer/features/navigation/state/navigationHistory'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectStore } from '@renderer/features/projects/state/useSelectedProjectStore'
import { canRestoreEntry } from './canRestoreEntry'

/** What {@link useGoBack} returns. */
interface GoBack {
  /** Whether the history has an entry to return to. */
  readonly canGoBack: boolean
  /** Returns to the newest place that can still be shown, or does nothing when there is none. */
  readonly goBack: () => void
}

/**
 * Back for the whole app. It returns to the newest history entry that can
 * still be shown (see {@link canRestoreEntry}), dropping the newer ones that
 * cannot: those whose project is gone, that are the place already on screen,
 * or whose session is known to be gone. When the entry belongs to another
 * project it selects that project too, marking the change as intended so the
 * app's reset on a project change keeps the restored session. It counts as a
 * navigation, so focus moves like it does for any other.
 *
 * It reads the project list and the cache when it is called, not when it was
 * made, so a project dropped by a refetch just before is skipped. It waits,
 * changing nothing, while the project list has not loaded. Its identity never
 * changes.
 *
 * Call it from any control or shortcut that goes back. It lives in the app
 * shell because it ties navigation to the projects and session detail
 * features, which navigation does not depend on.
 *
 * @returns Whether Back is possible, and the function that goes back.
 */
export function useGoBack(): GoBack {
  const canGoBack = useNavigationStore((state) => state.history.length > 0)
  const client = useQueryClient()

  const goBack = useCallback(() => {
    const projects = client.getQueryData<readonly ProjectDto[]>(['projects'])
    if (projects === undefined) return
    const navigation = useNavigationStore.getState()
    const current = entryOf(navigation)
    let entry = navigation.popEntry()
    while (entry !== undefined && !canRestoreEntry(entry, { projects, client, current })) {
      entry = navigation.popEntry()
    }
    if (entry === undefined) return
    const project = entry.projectDirName
    const switching = project !== null && project !== navigation.currentProjectDirName
    if (switching) navigation.markRestoringProject(project)
    navigation.restore(entry)
    if (switching) useSelectedProjectStore.getState().select(project)
  }, [client])

  return { canGoBack, goBack }
}
