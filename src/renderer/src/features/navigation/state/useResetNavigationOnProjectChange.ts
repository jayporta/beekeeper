import { useEffect, useRef } from 'react'
import { useSelectedProjectDirName } from '@renderer/features/projects/state/useSelectedProjectDirName'
import { useNavigationStore } from './useNavigationStore'

/**
 * Returns navigation to the sessions list, with no session or agent selected,
 * whenever the project in effect changes to another project. That covers a
 * selection and a silent fallback when the selected project is no longer
 * listed. The first project to load, and any gap while the list is
 * unavailable, are not changes.
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
    if (previous.current !== null && previous.current !== dirName) reset()
    previous.current = dirName
  }, [dirName, reset])
}
