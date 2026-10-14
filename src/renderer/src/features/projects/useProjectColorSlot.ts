import { groupProjects } from '../../../../shared/projects/groupProjects'
import { projectColorSlot, type ProjectColorSlot } from './projectColorSlot'
import { useProjects } from './useProjects'

/**
 * Looks up a folder's color slot, the one the sidebar gives its project. A
 * worktree takes its parent project's slot.
 *
 * @param dirName - The project folder's name, exactly as on disk.
 * @returns The slot, or `null` while the projects load or when the folder isn't listed.
 */
export function useProjectColorSlot(dirName: string): ProjectColorSlot | null {
  const { data } = useProjects()
  if (data === undefined) return null
  const index = groupProjects(data).findIndex(
    ({ project, worktrees }) =>
      project.dirName === dirName || worktrees.some((worktree) => worktree.dirName === dirName)
  )
  return index === -1 ? null : projectColorSlot(index)
}
