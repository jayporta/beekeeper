import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDailyUsageDto } from '../../../../../shared/ipc/projectDailyUsageDto'
import { TOTALS_WINDOWS, type TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'

/** A folder's cached daily usage and the window it was fetched for. */
export interface NewestDailyUsage {
  /** The usage. */
  readonly usage: ProjectDailyUsageDto
  /** The window the usage covers. */
  readonly range: TotalsWindowDto
}

/** Which folder's usage to look for, and for which window. */
export interface NewestDailyUsageQuery {
  /** The folder's name. */
  readonly dirName: string
  /** The window the usage is wanted for. */
  readonly range: TotalsWindowDto
}

/**
 * Finds the newest daily usage the cache holds for a folder, to show in place
 * of the usage that is loading. Usage fetched for the wanted window comes
 * first, from any day, so passing midnight keeps showing that window; only a
 * folder with none for it falls back to the other window's newest.
 *
 * @param client - The query client holding the usage queries.
 * @param query - The folder and the window.
 * @returns The folder's most recently fetched usage and its window, or `undefined` when none was fetched.
 */
export function newestDailyUsage(
  client: QueryClient,
  query: NewestDailyUsageQuery
): NewestDailyUsage | undefined {
  let newest: (NewestDailyUsage & { readonly at: number }) | undefined
  const cached = client.getQueriesData<ProjectDailyUsageDto>({
    queryKey: ['projectDailyUsage', query.dirName]
  })
  for (const [queryKey, usage] of cached) {
    const range = TOTALS_WINDOWS.find((window) => window === queryKey[2])
    if (usage === undefined || range === undefined) continue
    const at = client.getQueryState(queryKey)?.dataUpdatedAt ?? 0
    const wanted = range === query.range
    // The wanted window's usage beats the other's; within the same window the newer one wins.
    const better =
      newest === undefined ||
      (wanted && newest.range !== query.range) ||
      (wanted === (newest.range === query.range) && at > newest.at)
    if (better) newest = { usage, range, at }
  }
  return newest === undefined ? undefined : { usage: newest.usage, range: newest.range }
}
