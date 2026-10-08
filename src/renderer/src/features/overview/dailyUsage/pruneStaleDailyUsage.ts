import type { QueryClient } from '@tanstack/react-query'

/** Options for {@link pruneStaleDailyUsage}. */
export interface PruneStaleDailyUsageOptions {
  /** The folder whose usage to prune. */
  readonly dirName: string
  /** Today's local day, `YYYY-MM-DD`: the one day whose usage stays. */
  readonly todayKey: string
}

/**
 * Removes a folder's cached daily usage for every day but today, in both
 * windows. Each day's usage is keyed by the day it was fetched, so without
 * this the cache, and the copy persisted to disk, would gain a result per
 * folder per window every day.
 *
 * @param client - The query client holding the usage queries.
 * @param options - The folder and today's day key.
 */
export function pruneStaleDailyUsage(
  client: QueryClient,
  options: PruneStaleDailyUsageOptions
): void {
  client.removeQueries({
    queryKey: ['projectDailyUsage', options.dirName],
    predicate: (query) => query.queryKey[3] !== options.todayKey
  })
}
