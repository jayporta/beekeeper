import { useEffect } from 'react'
import {
  selectIsFirstRunShowing,
  useFirstRunStore
} from '@renderer/features/firstRun/state/useFirstRunStore'
import { useProjects } from '../useProjects'
import { useSelectedProjectStore } from './useSelectedProjectStore'

/**
 * Treats a stored selection that the project list no longer names as a gone
 * folder: it forgets the selection and records the folder, the same as when the
 * sessions load reports the folder missing. Because that clears the stored
 * value, it happens once per missing folder.
 *
 * It acts only on a list fetched since this component mounted, never on one
 * restored from the persisted cache, which may predate the stored selection.
 * It waits while the first-run screen shows, so the notice is not left to
 * surprise the person once the screen closes.
 *
 * Call it once, where the main area renders.
 */
export function useForgetUnlistedSelection(): void {
  const { data, isFetchedAfterMount } = useProjects()
  const stored = useSelectedProjectStore((state) => state.selectedDirName)
  const forgetGoneFolder = useSelectedProjectStore((state) => state.forgetGoneFolder)
  const firstRunShowing = useFirstRunStore(selectIsFirstRunShowing)

  useEffect(() => {
    if (firstRunShowing || !isFetchedAfterMount || data === undefined || stored === null) return
    if (!data.some((project) => project.dirName === stored)) forgetGoneFolder(stored)
  }, [data, isFetchedAfterMount, stored, forgetGoneFolder, firstRunShowing])
}
