import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { groupProjects } from './groupProjects'

/**
 * Finds the listed top-level project that a worktree folder is grouped under.
 *
 * @param projects - The listed projects, in display order.
 * @param worktree - The project to find the parent of.
 * @returns The parent project, or `null` when `worktree` is not a worktree
 * folder or its parent isn't a listed top-level project.
 */
export function parentProject(
  projects: readonly ProjectDto[],
  worktree: ProjectDto
): ProjectDto | null {
  const group = groupProjects(projects).find(({ worktrees }) =>
    worktrees.some(({ dirName }) => dirName === worktree.dirName)
  )
  return group?.project ?? null
}
