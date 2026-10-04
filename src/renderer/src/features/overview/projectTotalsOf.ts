import type { ProjectGroup } from '@renderer/features/projects/groupProjects'
import { LOADING, type FolderTotalsState } from './folderTotalsState'
import { sumTotals, type AggregateTotals } from './sumTotals'

/** Each folder's totals state, by folder name. A folder that is missing is still loading. */
export type TotalsByFolder = ReadonlyMap<string, FolderTotalsState>

function stateOf(byFolder: TotalsByFolder, dirName: string): FolderTotalsState {
  return byFolder.get(dirName) ?? LOADING
}

/**
 * Adds up a project: its own folder and the worktree folders grouped under
 * it. A folder's own totals cover only its own sessions, so the sum counts
 * nothing twice.
 *
 * @param group - The project and its worktrees.
 * @param byFolder - Each folder's totals state.
 * @returns The project's totals.
 */
export function projectTotalsOf(group: ProjectGroup, byFolder: TotalsByFolder): AggregateTotals {
  return sumTotals(
    [group.project, ...group.worktrees].map((folder) => stateOf(byFolder, folder.dirName))
  )
}

/**
 * Adds up every project.
 *
 * @param groups - Every project with its worktrees.
 * @param byFolder - Each folder's totals state.
 * @returns The overall totals.
 */
export function overviewTotals(
  groups: readonly ProjectGroup[],
  byFolder: TotalsByFolder
): AggregateTotals {
  return sumTotals(
    groups.flatMap(({ project, worktrees }) =>
      [project, ...worktrees].map((folder) => stateOf(byFolder, folder.dirName))
    )
  )
}
