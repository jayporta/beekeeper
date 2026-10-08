import { createLruMap } from '../../core/shared/lruMap'
import type { SessionDailyUsage } from '../../core/usage/dailyUsage'

/**
 * The default bound on the cache's total weight. A result weighs one plus its
 * bucket count, and a bucket is a few small fields.
 */
export const DAILY_USAGE_CACHE_MAX_WEIGHT = 200_000

/** What {@link DailyUsageCache.set} stores. */
export interface DailyUsageCacheEntry {
  /** The key covering every input file's identity and the time zone. */
  readonly key: string
  /** The session's usage. */
  readonly usage: SessionDailyUsage
  /** Whether the session's subagents folder was listed. */
  readonly subagentsListed: boolean
}

/** A least-recently-used cache of complete per-session daily usage. */
export interface DailyUsageCache {
  /**
   * Looks up a result, marking it most recently used.
   * @param key - The key it was stored under.
   * @returns The cached usage, or `undefined`.
   */
  get(key: string): SessionDailyUsage | undefined
  /**
   * Stores a result unless it is incomplete: a subagent transcript couldn't
   * be read, or the subagents folder couldn't be listed. Failures like these
   * can clear without the key changing.
   * @param entry - The key, the usage, and whether the subagents were listed.
   */
  set(entry: DailyUsageCacheEntry): void
}

/** Options for {@link createDailyUsageCache}. */
export interface DailyUsageCacheOptions {
  /**
   * The most total weight the cache keeps.
   * @defaultValue {@link DAILY_USAGE_CACHE_MAX_WEIGHT}
   */
  readonly maxWeight?: number
}

/**
 * Creates a cache of per-session daily usage, evicting least recently used
 * results once their total weight passes the bound.
 *
 * @param options - The weight bound.
 * @returns An empty cache.
 */
export function createDailyUsageCache(options: DailyUsageCacheOptions = {}): DailyUsageCache {
  const { maxWeight = DAILY_USAGE_CACHE_MAX_WEIGHT } = options
  const entries = createLruMap<string, SessionDailyUsage>({
    maxWeight,
    weigh: (usage) => 1 + usage.buckets.length
  })
  return {
    get: (key) => entries.get(key),
    set({ key, usage, subagentsListed }) {
      if (subagentsListed && usage.unreadableSubagents === 0) entries.set(key, usage)
    }
  }
}
