import type { ProjectDto } from '../../../../shared/ipc/projectDto'

/**
 * The name to show for a project: the label read from its transcripts, else
 * its folder name exactly as on disk. Transcript-derived, so render it as
 * plain text.
 *
 * @param project - The project.
 * @returns The label, or the folder name when there is none.
 */
export function projectLabel(project: ProjectDto): string {
  return project.label ?? project.dirName
}
