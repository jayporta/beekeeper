import { useCallback, useMemo } from 'react'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'
import type { TotalsWindowDto } from '../../../../shared/ipc/projectTotalsDto'
import { groupProjects, type ProjectGroup } from '@renderer/features/projects/groupProjects'
import { useProjects } from '@renderer/features/projects/useProjects'
import { folderTotalsOf, overviewTotals, projectTotalsOf } from './projectTotalsOf'
import type { AggregateTotals } from './sumTotals'
import { useProjectTotals } from './useProjectTotals'

/** One project with what it and its worktrees add up to. */
export interface ProjectGroupItem {
  /** The project and its worktrees. */
  readonly group: ProjectGroup
  /** What the project and its worktrees add up to. */
  readonly totals: AggregateTotals
}

/** What {@link useProjectGroupTotals} returns. */
export interface ProjectGroupTotals {
  /** The project listing, or `undefined` until it loads. */
  readonly projects: readonly ProjectDto[] | undefined
  /** The window the totals cover. */
  readonly window: TotalsWindowDto
  /** Each top-level project, in list order, with its totals. */
  readonly items: readonly ProjectGroupItem[]
  /** Every project added together. */
  readonly overall: AggregateTotals
  /** Adds up one folder on its own, such as a worktree row's figure. It keeps its identity until a folder's totals change. */
  readonly folderTotals: (dirName: string) => AggregateTotals
}

/**
 * Groups the listed projects with their worktrees and adds up each group and
 * the whole for the chosen window.
 *
 * @remarks
 * The overview and the sidebar share it, so both show the same figures. `items`
 * and `overall` keep their identity until the project list or a folder's totals
 * change.
 *
 * @returns The project listing (`undefined` until it loads), the window, each
 * project's totals, the total across all of them, and a function that adds up one folder.
 */
export function useProjectGroupTotals(): ProjectGroupTotals {
  const { data: projects } = useProjects()
  const { window: range, byFolder } = useProjectTotals()
  const groups = useMemo(() => groupProjects(projects ?? []), [projects])
  const items = useMemo(
    () => groups.map((group) => ({ group, totals: projectTotalsOf(group, byFolder) })),
    [groups, byFolder]
  )
  const overall = useMemo(() => overviewTotals(groups, byFolder), [groups, byFolder])
  const folderTotals = useCallback(
    (dirName: string) => folderTotalsOf(dirName, byFolder),
    [byFolder]
  )
  return { projects, window: range, items, overall, folderTotals }
}
