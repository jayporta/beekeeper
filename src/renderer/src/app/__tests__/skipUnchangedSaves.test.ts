import { dehydrate, QueryClient, type Query } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { shouldPersistQuery } from '../shouldPersistQuery'
import { skipUnchangedSaves } from '../skipUnchangedSaves'

/** A persister that records what it was asked to save. */
function spyPersister(): Persister & { readonly persistClient: Mock<Persister['persistClient']> } {
  return {
    persistClient: vi.fn<Persister['persistClient']>(),
    restoreClient: vi.fn(() => undefined),
    removeClient: vi.fn()
  }
}

/** Dehydrates `client` the way the persist provider does, stamped with `timestamp`. */
function snapshot(client: QueryClient, timestamp = Date.now()): PersistedClient {
  return {
    timestamp,
    buster: 'b',
    clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery })
  }
}

/** A cache holding one fresh `sessions` list, fetched `agoMs` milliseconds ago. */
function clientWithSessions(agoMs = 2000): QueryClient {
  const client = new QueryClient()
  client.setQueryData(['sessions', '-p'], ['a'], { updatedAt: Date.now() - agoMs })
  return client
}

describe('skipUnchangedSaves', () => {
  it('saves the first client it is given', async () => {
    const inner = spyPersister()

    await skipUnchangedSaves(inner).persistClient(snapshot(clientWithSessions()))

    expect(inner.persistClient).toHaveBeenCalledTimes(1)
  })

  it('skips a save when only a query outside the persisted roots was added or updated', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))

    client.setQueryData(['session', '-p', 's1'], { id: 's1' })
    await persister.persistClient(snapshot(client))
    client.setQueryData(['session', '-p', 's1'], { id: 's1', more: true })
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(1)
  })

  it('skips a save whose only difference is the client timestamp', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client, 1))

    await persister.persistClient(snapshot(client, 2))

    expect(inner.persistClient).toHaveBeenCalledTimes(1)
  })

  it('saves again when a persisted query is updated', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))

    client.setQueryData(['sessions', '-p'], ['a', 'b'], { updatedAt: Date.now() - 1000 })
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it('saves again when a persisted query gets new data stamped with the same update time', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))
    const updatedAt = client.getQueryState(['sessions', '-p'])?.dataUpdatedAt

    client.setQueryData(['sessions', '-p'], ['a', 'b'], { updatedAt })
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it('saves again when a persisted query is added', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))

    client.setQueryData(['projects'], [{ dirName: '-p' }])
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it('saves again when a persisted query is removed', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))

    client.removeQueries({ queryKey: ['sessions'] })
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it('saves again when a persisted query changes status without new data', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))

    await client
      .fetchQuery({
        queryKey: ['sessions', '-p'],
        queryFn: () => Promise.reject(new Error('refetch failed')),
        retry: false,
        staleTime: 0
      })
      .catch(() => undefined)
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it.each([
    [
      'another query takes its place with the same state',
      (client: QueryClient, query: Query) => {
        client.removeQueries({ queryKey: ['sessions'] })
        client.setQueryData(['sessions', '-q'], ['a'], { updatedAt: query.state.dataUpdatedAt })
      }
    ],
    [
      'its status changes',
      (_client: QueryClient, query: Query) => {
        query.setState({ ...query.state, status: 'error' })
      }
    ],
    [
      'its last error time changes',
      (_client: QueryClient, query: Query) => {
        query.setState({ ...query.state, errorUpdatedAt: query.state.dataUpdatedAt + 1 })
      }
    ],
    [
      'it fails again within the same millisecond',
      (_client: QueryClient, query: Query) => {
        query.setState({ ...query.state, errorUpdateCount: query.state.errorUpdateCount + 1 })
      }
    ]
  ])('saves again when %s', async (_label, change) => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    const query = client.getQueryCache().find({ queryKey: ['sessions', '-p'] })
    if (query === undefined) throw new Error('the sessions query was not cached')
    await persister.persistClient(snapshot(client))

    change(client, query)
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it('saves an unchanged client again once the saved cache has been removed', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)
    const client = clientWithSessions()
    await persister.persistClient(snapshot(client))

    await persister.removeClient()
    await persister.persistClient(snapshot(client))

    expect(inner.persistClient).toHaveBeenCalledTimes(2)
  })

  it('passes restore and remove through to the persister it wraps', async () => {
    const inner = spyPersister()
    const persister = skipUnchangedSaves(inner)

    await persister.restoreClient()
    await persister.removeClient()

    expect(inner.restoreClient).toHaveBeenCalledTimes(1)
    expect(inner.removeClient).toHaveBeenCalledTimes(1)
  })
})
