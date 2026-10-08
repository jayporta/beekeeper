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

/**
 * Finds the newest daily usage the cache holds for a folder, under any window
 * or day, to show in place of the usage that is loading.
 *
 * @param client - The query client holding the usage queries.
 * @param dirName - The folder's name.
 * @returns The folder's most recently fetched usage and its window, or `undefined` when none was fetched.
 */
export function newestDailyUsage(
  client: QueryClient,
  dirName: string
): NewestDailyUsage | undefined {
  let newest: (NewestDailyUsage & { readonly at: number }) | undefined
  const cached = client.getQueriesData<ProjectDailyUsageDto>({
    queryKey: ['projectDailyUsage', dirName]
  })
  for (const [queryKey, usage] of cached) {
    const range = TOTALS_WINDOWS.find((window) => window === queryKey[2])
    const at = client.getQueryState(queryKey)?.dataUpdatedAt ?? 0
    if (usage !== undefined && range !== undefined && (newest === undefined || at > newest.at)) {
      newest = { usage, range, at }
    }
  }
  return newest === undefined ? undefined : { usage: newest.usage, range: newest.range }
}
