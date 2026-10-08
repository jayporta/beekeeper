import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDailyUsageDto } from '../../../../../shared/ipc/projectDailyUsageDto'
import type { TotalsWindowDto } from '../../../../../shared/ipc/projectTotalsDto'
import { newestDailyUsage, type NewestDailyUsageQuery } from './newestDailyUsage'

/** The window each placeholder usage belongs to, by the usage itself. */
const sourceRanges = new WeakMap<ProjectDailyUsageDto, TotalsWindowDto>()

/**
 * Which window a usage that stood in as a placeholder was fetched for.
 *
 * @param usage - Usage a placeholder gave.
 * @returns Its window, or `undefined` when no placeholder gave it.
 */
export function placeholderRange(usage: ProjectDailyUsageDto): TotalsWindowDto | undefined {
  return sourceRanges.get(usage)
}

/**
 * Creates the placeholder for one folder's daily usage query: the folder's
 * newest cached usage, preferring the query's own window, which shows until the query's own usage arrives. A
 * search that finds nothing is remembered, so a folder with nothing cached
 * is not searched for again on every render. Make a new one when the window
 * or day changes, so the next search sees what has been cached since.
 *
 * @param client - The query client holding the usage queries.
 * @param query - The folder and the window the query is for.
 * @returns The placeholder function to give the query.
 */
export function createDailyUsagePlaceholder(
  client: QueryClient,
  query: NewestDailyUsageQuery
): () => ProjectDailyUsageDto | undefined {
  let missed = false
  return () => {
    if (missed) return undefined
    const newest = newestDailyUsage(client, query)
    if (newest === undefined) {
      missed = true
      return undefined
    }
    sourceRanges.set(newest.usage, newest.range)
    return newest.usage
  }
}
