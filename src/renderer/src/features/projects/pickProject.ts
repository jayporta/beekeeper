import type { ProjectDto } from '../../../../shared/ipc/projectDto'

/**
 * Chooses which project is selected: the stored one when it is still listed,
 * otherwise the first parent project (one that is not a worktree folder).
 *
 * @param projects - The listed projects, in display order.
 * @param stored - The folder name last selected, or `null` for none.
 * @returns The folder name to select, or `null` when there are no projects.
 */
export function pickProject(projects: readonly ProjectDto[], stored: string | null): string | null {
  if (stored !== null && projects.some((project) => project.dirName === stored)) return stored
  const fallback = projects.find((project) => project.worktreeOf === null) ?? projects[0]
  return fallback?.dirName ?? null
}
