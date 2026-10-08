import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDailyUsageDto } from '../../../../../shared/ipc/projectDailyUsageDto'

/**
 * Finds the newest daily usage the cache holds for a folder, under any window
 * or day, to show in place of the usage that is loading.
 *
 * @param client - The query client holding the usage queries.
 * @param dirName - The folder's name.
 * @returns The folder's most recently fetched usage, or `undefined` when none was fetched.
 */
export function newestDailyUsage(
  client: QueryClient,
  dirName: string
): ProjectDailyUsageDto | undefined {
  let newest: { readonly at: number; readonly data: ProjectDailyUsageDto } | undefined
  for (const query of client
    .getQueryCache()
    .findAll({ queryKey: ['projectDailyUsage', dirName] })) {
    const data = query.state.data as ProjectDailyUsageDto | undefined
    if (data !== undefined && (newest === undefined || query.state.dataUpdatedAt > newest.at)) {
      newest = { at: query.state.dataUpdatedAt, data }
    }
  }
  return newest?.data
}
