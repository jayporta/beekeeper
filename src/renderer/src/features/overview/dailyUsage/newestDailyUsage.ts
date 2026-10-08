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
  let newest: { readonly at: number; readonly usage: ProjectDailyUsageDto } | undefined
  const cached = client.getQueriesData<ProjectDailyUsageDto>({
    queryKey: ['projectDailyUsage', dirName]
  })
  for (const [queryKey, usage] of cached) {
    const at = client.getQueryState(queryKey)?.dataUpdatedAt ?? 0
    if (usage !== undefined && (newest === undefined || at > newest.at)) newest = { at, usage }
  }
  return newest?.usage
}
