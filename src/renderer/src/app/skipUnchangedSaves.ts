import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

/**
 * Summarizes which persisted queries a client holds and the state each is
 * in. The update counts change with every new result, even one stamped with
 * the same time as the last. The client's own `timestamp` is left out: it
 * changes on every save, so it would make every client look new.
 */
function fingerprintOf(client: PersistedClient): string {
  return JSON.stringify(
    client.clientState.queries.map(({ queryHash, state }) => [
      queryHash,
      state.dataUpdatedAt,
      state.dataUpdateCount,
      state.errorUpdatedAt,
      state.errorUpdateCount,
      state.status
    ])
  )
}

/**
 * Wraps a persister so a save is skipped when the persisted queries are
 * unchanged since the last save started. A skipped save resolves at once,
 * without waiting for the save it matches. The persist provider dehydrates and saves on
 * every cache event, so without this a query that is never persisted (such as
 * a session's detail) would rewrite the whole saved cache each time it
 * updates.
 *
 * Removing the saved cache, or a failed save, forgets the last save, so the
 * next one always writes, even when only a query that is never persisted
 * changed.
 *
 * @param createPersister - Creates the persister that does the saving, given
 * the callback it calls when a save fails.
 * @returns A persister that saves only when a persisted query has changed.
 */
export function skipUnchangedSaves(
  createPersister: (forgetLastSave: () => void) => Persister
): Persister {
  let lastSaved: string | undefined
  const persister = createPersister(() => {
    lastSaved = undefined
  })

  return {
    persistClient(client) {
      const fingerprint = fingerprintOf(client)
      if (fingerprint === lastSaved) return
      lastSaved = fingerprint
      return persister.persistClient(client)
    },
    restoreClient: () => persister.restoreClient(),
    removeClient() {
      lastSaved = undefined
      return persister.removeClient()
    }
  }
}
