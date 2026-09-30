import { createStore, del, get, set, type UseStore } from 'idb-keyval'

const DATABASE_NAME = 'beekeeper'
const STORE_NAME = 'app'

let store: UseStore | undefined

/** Opens the dedicated store on first use, so importing this module touches no IndexedDB. */
function getStore(): UseStore {
  store ??= createStore(DATABASE_NAME, STORE_NAME)
  return store
}

/**
 * The one IndexedDB adapter for persisted renderer data, kept in its own
 * database and store rather than `idb-keyval`'s default. Values are strings,
 * so it satisfies TanStack Query's async persister storage and Zustand's
 * `createJSONStorage` without conversion.
 *
 * Failures reject and are never caught here. TanStack's persister handles a
 * rejected read or write itself. Zustand does not wait on a write, so stores
 * use `zustandIdbStorage`, which handles the rejection. Nothing is logged
 * here, since stored values are derived from transcripts.
 *
 * @example
 * const persister = createAsyncStoragePersister({ storage: idbStorage })
 */
export const idbStorage = {
  /**
   * Reads a value.
   * @param key - The key it was stored under.
   * @returns The stored string, or `null` when the key was never written.
   */
  async getItem(key: string): Promise<string | null> {
    const value = await get<string>(key, getStore())
    return value ?? null
  },
  /**
   * Writes a value, replacing any existing one.
   * @param key - The key to store it under.
   * @param value - The string to store.
   */
  async setItem(key: string, value: string): Promise<void> {
    await set(key, value, getStore())
  },
  /**
   * Deletes a value. Deleting a missing key is not an error.
   * @param key - The key to delete.
   */
  async removeItem(key: string): Promise<void> {
    await del(key, getStore())
  }
}
