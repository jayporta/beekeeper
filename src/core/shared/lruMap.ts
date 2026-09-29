/** Options for {@link createLruMap}. */
export interface LruMapOptions<V> {
  /** The most total weight the map keeps. */
  readonly maxWeight: number
  /**
   * The weight of one value: a non-negative, finite number. Read once, when
   * the value is stored, so it must not change afterwards.
   */
  readonly weigh: (value: V) => number
}

/** A map that evicts its least recently used entries once their total weight passes a bound. */
export interface LruMap<K, V> {
  /**
   * Looks up a value, marking it most recently used.
   * @param key - The key to look up.
   * @returns The value, or `undefined` when the key is absent.
   */
  get(key: K): V | undefined
  /**
   * Stores a value as the most recently used, replacing any value under the
   * key, then evicts least recently used entries until the total weight is
   * within the bound. A value heavier than the whole bound is not stored,
   * and any value it would have replaced is removed.
   * @param key - The key to store under.
   * @param value - The value to store.
   */
  set(key: K, value: V): void
  /** How many entries are stored. */
  readonly size: number
  /** The total weight of the stored entries, never above the bound. */
  readonly weight: number
}

interface LruEntry<V> {
  readonly value: V
  readonly weight: number
}

/**
 * Creates a weight-bounded least-recently-used map. Recency follows the
 * order of a `Map`'s keys, and the total weight is tracked as entries come
 * and go, so no operation rescans the entries.
 *
 * @param options - The weight bound and how to weigh a value. A weight of 1
 * for every value makes the bound a plain entry count.
 * @returns An empty map.
 */
export function createLruMap<K, V>(options: LruMapOptions<V>): LruMap<K, V> {
  const entries = new Map<K, LruEntry<V>>()
  let totalWeight = 0

  function remove(key: K): void {
    const entry = entries.get(key)
    if (entry === undefined) return
    entries.delete(key)
    totalWeight -= entry.weight
  }

  return {
    get(key) {
      const entry = entries.get(key)
      if (entry === undefined) return undefined
      entries.delete(key)
      entries.set(key, entry)
      return entry.value
    },
    set(key, value) {
      remove(key)
      const weight = options.weigh(value)
      if (weight > options.maxWeight) return

      entries.set(key, { value, weight })
      totalWeight += weight
      while (totalWeight > options.maxWeight) {
        const oldest = entries.keys().next()
        if (oldest.done === true) return
        remove(oldest.value)
      }
    },
    get size() {
      return entries.size
    },
    get weight() {
      return totalWeight
    }
  }
}
