import { useEffect, useRef } from 'react'
import { isProjectChange } from '@renderer/features/navigation/isProjectChange'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'

/**
 * Keeps navigation in step with the project in effect. It records the project
 * for the navigation history, and returns navigation to the sessions list,
 * with no session or agent selected, whenever the project changes to another
 * project. That covers a selection and a silent fallback when the selected
 * project is no longer listed. The first project to load, and any gap while the
 * list is unavailable, are not changes. The overview is not about one project,
 * so a change never leaves it. A change a Back marked as intended (see
 * `restoringProject`) keeps the view the Back restored.
 *
 * Call it once, where the main area renders. It is an effect because it
 * syncs one store to another outside source: nothing here derives from
 * render, since a session ref left behind by the old project would still be
 * valid data.
 */
export function useResetNavigationOnProjectChange(): void {
  const dirName = useSelectedProjectDirName()
  const previous = useRef<string | null>(null)

  useEffect(() => {
    if (dirName === null) return
    const navigation = useNavigationStore.getState()
    const changed = isProjectChange(previous.current, dirName)
    const restoring = navigation.restoringProject === dirName
    if (changed && navigation.view !== 'overview' && !restoring) navigation.reset()
    navigation.syncProject(dirName)
    previous.current = dirName
  }, [dirName])
}
