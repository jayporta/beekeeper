import type { DailyUsageBucket } from './dailyUsage'

/**
 * Orders daily usage buckets by day, then by model.
 *
 * @param a - The first bucket.
 * @param b - The second bucket.
 * @returns A negative number when `a` sorts first, positive when `b` does, otherwise zero.
 */
export function compareDailyUsageBuckets(a: DailyUsageBucket, b: DailyUsageBucket): number {
  return a.day.localeCompare(b.day) || a.model.localeCompare(b.model)
}
