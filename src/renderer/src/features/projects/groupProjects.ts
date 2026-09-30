import type { ProjectDto } from '../../../../shared/ipc/projectDto'

/** A top-level project with the worktree folders grouped under it. */
export interface ProjectGroup {
  /** The top-level project. */
  readonly project: ProjectDto
  /** Worktree folders of `project`, in the order listed. Empty when it has none. */
  readonly worktrees: readonly ProjectDto[]
}

/**
 * Groups worktree folders under their parent project. A project is top-level
 * when it is not a worktree folder, or when its parent isn't a listed
 * top-level project, so no project is ever dropped.
 *
 * @param projects - The listed projects, in display order.
 * @returns One group per top-level project, in the order listed.
 */
export function groupProjects(projects: readonly ProjectDto[]): readonly ProjectGroup[] {
  const parentNames = new Set(
    projects.filter((project) => project.worktreeOf === null).map((project) => project.dirName)
  )
  const isNested = (project: ProjectDto): boolean =>
    project.worktreeOf !== null && parentNames.has(project.worktreeOf)

  return projects
    .filter((project) => !isNested(project))
    .map((project) => ({
      project,
      worktrees: projects.filter((other) => isNested(other) && other.worktreeOf === project.dirName)
    }))
}
