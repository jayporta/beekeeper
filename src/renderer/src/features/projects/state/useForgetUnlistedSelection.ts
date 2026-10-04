import { useEffect } from 'react'
import { useProjects } from '../useProjects'
import { useSelectedProjectStore } from './useSelectedProjectStore'

/**
 * Treats a stored selection that the loaded project list no longer names as a
 * gone folder: it forgets the selection and records the folder, the same as
 * when the sessions load reports the folder missing. Because that clears the
 * stored value, it happens once per missing folder.
 */
export function useForgetUnlistedSelection(): void {
  const { data } = useProjects()
  const stored = useSelectedProjectStore((state) => state.selectedDirName)
  const forgetGoneFolder = useSelectedProjectStore((state) => state.forgetGoneFolder)

  useEffect(() => {
    if (data === undefined || stored === null) return
    if (!data.some((project) => project.dirName === stored)) forgetGoneFolder(stored)
  }, [data, stored, forgetGoneFolder])
}
