import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Persister } from '@tanstack/react-query-persist-client'
import { idbStorage } from '@renderer/storage/idbStorage'

/** The storage the persister saves to: anything with async string `getItem`, `setItem` and `removeItem`. */
type PersisterStorage = NonNullable<Parameters<typeof createAsyncStoragePersister>[0]['storage']>

/** The IndexedDB key the query cache is stored under. */
const QUERY_CACHE_KEY = 'beekeeper-query-cache'

/**
 * Logs that a save failed and gives up, instead of retrying or dropping the
 * failure silently. The message is fixed: the cache key, its value, and the
 * error can all carry transcript-derived text.
 */
function giveUpOnSave(): Promise<undefined> {
  console.error('Beekeeper could not save its query cache to IndexedDB.')
  return Promise.resolve(undefined)
}

/**
 * Logs that the saved cache could not be restored. The message is fixed, for
 * the same reason as a failed save.
 */
export function logPersistError(): void {
  console.error('Beekeeper could not restore its query cache from IndexedDB.')
}

/**
 * Creates the persister that saves the query cache to IndexedDB. A failed
 * save is logged once and given up on, so the app keeps working without it.
 *
 * @param storage - Where to save. Defaults to the app's IndexedDB adapter.
 * @returns The persister.
 */
export function createQueryPersister(storage: PersisterStorage = idbStorage): Persister {
  return createAsyncStoragePersister({ storage, key: QUERY_CACHE_KEY, retry: giveUpOnSave })
}
