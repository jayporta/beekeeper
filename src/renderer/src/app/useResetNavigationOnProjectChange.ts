import { useEffect, useRef } from 'react'
import { isProjectChange } from '@renderer/features/navigation/isProjectChange'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'

/**
 * Returns navigation to the sessions list, with no session or agent selected,
 * whenever the project in effect changes to another project. That covers a
 * selection and a silent fallback when the selected project is no longer
 * listed. The first project to load, and any gap while the list is
 * unavailable, are not changes. The overview is not about one project, so a
 * change never leaves it.
 *
 * Call it once, where the main area renders. It is an effect because it
 * syncs one store to another outside source: nothing here derives from
 * render, since a session ref left behind by the old project would still be
 * valid data.
 */
export function useResetNavigationOnProjectChange(): void {
  const dirName = useSelectedProjectDirName()
  const reset = useNavigationStore((state) => state.reset)
  const previous = useRef<string | null>(null)

  useEffect(() => {
    if (dirName === null) return
    const changed = isProjectChange(previous.current, dirName)
    if (changed && useNavigationStore.getState().view !== 'overview') reset()
    previous.current = dirName
  }, [dirName, reset])
}
