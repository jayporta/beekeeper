import { projectTitle } from '../../../../shared/projects/projectTitle'
import { totalsStatus } from './sumTotals'
import type { ProjectGroupItem } from './useProjectGroupTotals'

/** How the projects table can be ordered, in the order the menu offers them. */
export const PROJECT_SORT_KEYS = ['tokens', 'latest', 'name'] as const

/** One way to order the projects table. */
export type ProjectSortKey = (typeof PROJECT_SORT_KEYS)[number]

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** Orders two items by the title they show, then by folder name, so same-named projects keep a fixed order. */
function byName(a: ProjectGroupItem, b: ProjectGroupItem): number {
  return (
    collator.compare(projectTitle(a.group.project), projectTitle(b.group.project)) ||
    compareText(a.group.project.dirName, b.group.project.dirName)
  )
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** A project's latest session time, or `-Infinity` for one with none. */
const latestOf = (item: ProjectGroupItem): number => item.totals.latest?.latestMs ?? -Infinity

/** The order of two items whose totals have arrived, for a key that ranks by figures. */
const RANKED: Readonly<
  Record<'tokens' | 'latest', (a: ProjectGroupItem, b: ProjectGroupItem) => number>
> = {
  tokens: (a, b) => b.totals.tokens - a.totals.tokens,
  latest: (a, b) => {
    const [x, y] = [latestOf(a), latestOf(b)]
    return x === y ? 0 : y > x ? 1 : -1
  }
}

/**
 * Orders the projects for the overview's table. Tokens puts the busiest first
 * and latest the most recently active first. Both put a project whose totals
 * are loading or failed after the rest, in the order given, so its row keeps a
 * stable place. Name sorts every project, loading or not, by the title it
 * shows. Ties break by folder name, so the order never depends on the input's.
 *
 * @param items - The projects with their totals, in sidebar order.
 * @param key - How to order them.
 * @returns A new array in the chosen order.
 */
export function sortProjects(
  items: readonly ProjectGroupItem[],
  key: ProjectSortKey
): readonly ProjectGroupItem[] {
  if (key === 'name') return [...items].sort(byName)

  const ready = items.filter(({ totals }) => totalsStatus(totals) === 'ready')
  const rest = items.filter(({ totals }) => totalsStatus(totals) !== 'ready')
  return [...ready.sort((a, b) => RANKED[key](a, b) || byName(a, b)), ...rest]
}
