import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import { projectLabel } from './projectLabel'

/** What a worktree folder's name carries between its parent's name and its own. */
const WORKTREE_MARKER = '--claude-worktrees-'

/**
 * The short name to show for a worktree folder: the part of its folder name
 * after the first worktree marker. A folder without the marker, or with
 * nothing after it, shows its {@link projectLabel} instead.
 *
 * @param project - The worktree project.
 * @returns The short name.
 */
export function worktreeShortName(project: ProjectDto): string {
  const at = project.dirName.indexOf(WORKTREE_MARKER)
  const name = at < 0 ? '' : project.dirName.slice(at + WORKTREE_MARKER.length)
  return name.length > 0 ? name : projectLabel(project)
}
