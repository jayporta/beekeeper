import { useMemo } from 'react'
import { groupProjects } from './groupProjects'
import { projectColorSlot, type ProjectColorSlot } from './projectColorSlot'
import { useProjects } from './useProjects'

/**
 * Finds the color slot of the top-level project that a folder is, or is a
 * worktree of. The slot comes from the project's place in the current sidebar
 * order each time, so it moves when the listing changes.
 *
 * @param dirName - The folder name, or `null` when no folder is in view.
 * @returns The slot, or `null` while the projects load, when `dirName` is
 * `null`, or when the folder isn't listed.
 */
export function useProjectColorSlot(dirName: string | null): ProjectColorSlot | null {
  const { data: projects } = useProjects()
  const groups = useMemo(() => groupProjects(projects ?? []), [projects])
  if (dirName === null) return null
  const index = groups.findIndex(
    ({ project, worktrees }) =>
      project.dirName === dirName || worktrees.some((worktree) => worktree.dirName === dirName)
  )
  return index === -1 ? null : projectColorSlot(index)
}
