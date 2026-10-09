import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { idbStorage } from '@renderer/storage/idbStorage'
import { keepFreshSavedQueries } from './keepFreshSavedQueries'
import { PERSIST_THROTTLE_MS } from './persistThrottle'
import { skipUnchangedSaves } from './skipUnchangedSaves'
import { toCachedQueryState } from './toCachedQueryState'

/** The storage the persister saves to: anything with async string `getItem`, `setItem` and `removeItem`. */
type PersisterStorage = NonNullable<Parameters<typeof createAsyncStoragePersister>[0]['storage']>

/** The message of the error a saved cache that can't be read throws: fixed, since the cache is untrusted. */
const UNREADABLE_CACHE_MESSAGE = 'Beekeeper could not read its saved query cache.'

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
 * Serializes the cache for saving, with each query's state rewritten by
 * {@link toCachedQueryState} so an errored list that holds data is saved as a
 * success.
 */
function serializeClient(client: PersistedClient): string {
  return JSON.stringify({
    ...client,
    clientState: {
      ...client.clientState,
      queries: client.clientState.queries.map((query) => ({
        ...query,
        state: toCachedQueryState(query.state)
      }))
    }
  })
}

/**
 * Parses the saved cache and drops the queries that are now too old. A
 * `JSON.parse` error quotes part of its input, which here is
 * transcript-derived, and the persister logs a restore error in development,
 * so a failure, including a saved value of the wrong shape, throws a fixed
 * error with no cause instead.
 */
function parseSavedCache(saved: string): PersistedClient {
  let parsed: unknown
  try {
    parsed = JSON.parse(saved)
  } catch {
    throw new Error(UNREADABLE_CACHE_MESSAGE)
  }

  const fresh = keepFreshSavedQueries(parsed)
  if (fresh === undefined) throw new Error(UNREADABLE_CACHE_MESSAGE)
  return fresh
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
 * The next cache event tries again, so while saves keep failing, every cache
 * event retries and logs, at most once every {@link PERSIST_THROTTLE_MS}.
 * Otherwise a save is skipped when the persisted queries haven't changed since
 * the last one, and saves are at least that far apart, the latest change
 * winning.
 *
 * @param storage - Where to save. Defaults to the app's IndexedDB adapter.
 * @returns The persister.
 */
export function createQueryPersister(storage: PersisterStorage = idbStorage): Persister {
  return skipUnchangedSaves((forgetLastSave) =>
    createAsyncStoragePersister({
      storage,
      key: QUERY_CACHE_KEY,
      throttleTime: PERSIST_THROTTLE_MS,
      retry: () => {
        forgetLastSave()
        return giveUpOnSave()
      },
      serialize: serializeClient,
      deserialize: parseSavedCache
    })
  )
}
