import type { QueryClient } from '@tanstack/react-query'

/** Options for {@link pruneStaleDailyUsage}. */
export interface PruneStaleDailyUsageOptions {
  /** The folder whose usage to prune. */
  readonly dirName: string
  /** The local day, `YYYY-MM-DD`, from which usage stays: the day of the response being stored. */
  readonly todayKey: string
}

/**
 * Removes a folder's cached daily usage for every day before `todayKey`, in
 * both windows. Each day's usage is keyed by the day it was fetched, so without
 * this the cache, and the copy persisted to disk, would gain a result per
 * folder per window every day. A later day's usage is never removed, so a
 * response that arrives after midnight, for a request sent before it, prunes
 * nothing that is newer than its own day.
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
    predicate: (query) => String(query.queryKey[3]) < options.todayKey
  })
}
