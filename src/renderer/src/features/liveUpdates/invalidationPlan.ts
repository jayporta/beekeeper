import type { FilesChangedDto } from '../../../../shared/ipc/filesChangedDto'
import type { ProjectDto } from '../../../../shared/ipc/projectDto'

/** The project families to refresh, or `all`. */
export type Families = ReadonlySet<string> | 'all'

/** Which cached queries a batch of file changes should refresh. */
export interface InvalidationPlan {
  /** Whether to refetch the project list. */
  readonly projects: boolean
  /** The project families whose session lists and details refresh, or `all`. */
  readonly families: Families
  /** The folders whose totals and daily usage are marked stale, or `all`. */
  readonly staleTotals: ReadonlySet<string> | 'all'
}

/**
 * Names the family a project folder belongs to.
 *
 * @param dirName - A project folder name.
 * @param projects - The cached project list, or `undefined` before it has loaded.
 * @returns The folder's worktree parent when it is a listed worktree folder, otherwise the folder itself.
 */
export function familyOf(dirName: string, projects: readonly ProjectDto[] | undefined): string {
  return projects?.find((project) => project.dirName === dirName)?.worktreeOf ?? dirName
}

/**
 * Whether a query's folder belongs to one of the families.
 *
 * @param families - The families to refresh, or `all`.
 * @param projects - The cached project list, or `undefined` before it has loaded.
 * @param queryKey - The query's key, whose second element is its folder name.
 * @returns `true` for any key when the families are `all`, otherwise when the key's folder is in one of them.
 */
export function isInFamilies(
  families: Families,
  projects: readonly ProjectDto[] | undefined,
  queryKey: readonly unknown[]
): boolean {
  const dirName = queryKey[1]
  return (
    families === 'all' || (typeof dirName === 'string' && families.has(familyOf(dirName, projects)))
  )
}

/**
 * Plans what a batch of file changes refreshes. Session lists and details
 * refresh by family, since a list spans a project's worktree folders. Totals
 * are only marked stale, by folder, because each reads a whole folder.
 *
 * @param change - The batch from the main process.
 * @param projects - The cached project list, or `undefined` before it has loaded.
 * @returns The plan.
 */
export function invalidationPlan(
  change: FilesChangedDto,
  projects: readonly ProjectDto[] | undefined
): InvalidationPlan {
  if (change.all) return { projects: true, families: 'all', staleTotals: 'all' }
  const listed = new Set(projects?.map((project) => project.dirName))
  return {
    projects: change.foldersChanged || change.dirNames.some((dirName) => !listed.has(dirName)),
    families: new Set(change.dirNames.map((dirName) => familyOf(dirName, projects))),
    staleTotals: new Set(change.dirNames)
  }
}
