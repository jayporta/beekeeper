import type { StateStorage } from 'zustand/middleware'
import { idbStorage } from './idbStorage'

/**
 * `idbStorage` as Zustand's `persist` uses it. Zustand starts a write when a
 * store changes and never waits on it, so a write that rejects would surface
 * as an unhandled promise rejection. Here a failed write or delete is logged
 * and resolves, so the in-memory state still applies for the session and the
 * value is just not saved. A failed read is logged and rethrown, since
 * Zustand's rehydration handles a rejected read.
 *
 * The log names only the key. The value and the error are left out, since a
 * stored value can be derived from transcripts.
 *
 * @example
 * storage: createJSONStorage(() => zustandIdbStorage)
 */
export const zustandIdbStorage: StateStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await idbStorage.getItem(key)
    } catch (error) {
      console.error(`Beekeeper could not read "${key}" from IndexedDB.`)
      throw error
    }
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
