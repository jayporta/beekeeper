import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { projectLabel } from './projectLabel'

/**
 * The name to show for a project as a title: a worktree folder's own name,
 * else the project's label. Transcript-derived, so render it as plain text.
 *
 * @param project - The project.
 * @returns The worktree's name, or the project's label (the folder name when it has none).
 */
export function projectTitle(project: ProjectDto): string {
  return project.worktreeName ?? projectLabel(project)
}
