import { createLruMap } from '../../core/shared/lruMap'
import type { SessionDailyUsage } from '../../core/usage/dailyUsage'

/**
 * The default bound on the cache's total weight. A result weighs one plus its
 * bucket count, and a bucket is a few small fields.
 */
export const DAILY_USAGE_CACHE_MAX_WEIGHT = 200_000

/** What identifies one lookup in a {@link DailyUsageCache}. */
export interface DailyUsageCacheLookup {
  /** Identifies the session, and the time zone its days are bucketed in. */
  readonly key: string
  /** Identifies the session's input files as they are now: a changed one is a miss. */
  readonly filesKey: string
}

/** What {@link DailyUsageCache.set} stores. */
export interface DailyUsageCacheEntry extends DailyUsageCacheLookup {
  /** The session's usage. */
  readonly usage: SessionDailyUsage
  /** Whether the session's subagents folder was listed. */
  readonly subagentsListed: boolean
}

/** A least-recently-used cache of complete per-session daily usage, one entry per session. */
export interface DailyUsageCache {
  /**
   * Looks up a result, marking it most recently used.
   * @param lookup - The session's key and the files key it has now.
   * @returns The cached usage, or `undefined` when none is stored for the session or its files have changed since.
   */
  get(lookup: DailyUsageCacheLookup): SessionDailyUsage | undefined
  /**
   * Stores a result, replacing the session's earlier entry, unless it is
   * incomplete: a subagent transcript couldn't be read, or the subagents
   * folder couldn't be listed. Failures like these can clear without the
   * files key changing.
   * @param entry - The session's key, the files key, the usage, and whether the subagents were listed.
   */
  set(entry: DailyUsageCacheEntry): void
  /** How many sessions have an entry. */
  readonly size: number
}

/** Options for {@link createDailyUsageCache}. */
export interface DailyUsageCacheOptions {
  /**
   * The most total weight the cache keeps.
   * @defaultValue {@link DAILY_USAGE_CACHE_MAX_WEIGHT}
   */
  readonly maxWeight?: number
}

/** What is kept for one session: its usage and the files key it was read at. */
interface CachedUsage {
  readonly filesKey: string
  readonly usage: SessionDailyUsage
}

/**
 * Creates a cache of per-session daily usage, keyed by session so a session
 * that keeps being written to holds one entry, not one for every state of its
 * files. Entries are evicted least recently used first once their total weight
 * passes the bound.
 *
 * @param options - The weight bound.
 * @returns An empty cache.
 */
export function createDailyUsageCache(options: DailyUsageCacheOptions = {}): DailyUsageCache {
  const { maxWeight = DAILY_USAGE_CACHE_MAX_WEIGHT } = options
  const entries = createLruMap<string, CachedUsage>({
    maxWeight,
    weigh: ({ usage }) => 1 + usage.buckets.length
  })
  return {
    get({ key, filesKey }) {
      const cached = entries.get(key)
      return cached?.filesKey === filesKey ? cached.usage : undefined
    },
    set({ key, filesKey, usage, subagentsListed }) {
      if (subagentsListed && usage.unreadableSubagents === 0) entries.set(key, { filesKey, usage })
    },
    get size() {
      return entries.size
    }
  }
}
