import type { StateStorage } from 'zustand/middleware'
import { idbStorage } from './idbStorage'

/**
 * `idbStorage` as Zustand's `persist` uses it. Zustand starts a write when a
 * store changes and never waits on it, so a write that rejects would surface
 * as an unhandled promise rejection. Here a failed write or delete is logged
 * and resolves, so the in-memory state still applies for the session and the
 * value is just not saved. A failed read is rethrown unchanged, since
 * Zustand's rehydration handles it; the store reports it, with parse
 * failures, through `logRehydrateError`.
 *
 * The logs name only the key. The value and the error are left out, since a
 * stored value can be derived from transcripts.
 *
 * @example
 * storage: createJSONStorage(() => zustandIdbStorage)
 */
export const zustandIdbStorage: StateStorage = {
  getItem(key: string): Promise<string | null> {
    return idbStorage.getItem(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await idbStorage.setItem(key, value)
    } catch {
      console.error(`Beekeeper could not save "${key}" to IndexedDB.`)
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await idbStorage.removeItem(key)
    } catch {
      console.error(`Beekeeper could not remove "${key}" from IndexedDB.`)
    }
  }
}
