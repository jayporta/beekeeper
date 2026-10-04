import 'fake-indexeddb/auto'
import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryPersister, logPersistError } from '../queryPersister'
import { shouldPersistQuery } from '../shouldPersistQuery'

afterEach(() => {
  vi.restoreAllMocks()
})

/** An in-memory stand-in for the persister's storage. */
const memoryStorage = (): NonNullable<Parameters<typeof createQueryPersister>[0]> => {
  const stored = new Map<string, string>()
  return {
    getItem: (key) => Promise.resolve(stored.get(key) ?? null),
    setItem: (key, value) => Promise.resolve(void stored.set(key, value)),
    removeItem: (key) => Promise.resolve(void stored.delete(key))
  }
}

const CLIENT = {
  timestamp: Date.now(),
  buster: 'b',
  clientState: { queries: [], mutations: [] }
}

describe('createQueryPersister', () => {
  it('logs one fixed message, never the key or value, and gives up when a save fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing = {
      getItem: () => Promise.resolve(null),
      setItem: vi.fn(() => Promise.reject(new Error('quota exceeded: secret value'))),
      removeItem: () => Promise.resolve()
    }

    await createQueryPersister(failing).persistClient(CLIENT)

    expect(failing.setItem).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledTimes(1)
    const [message] = log.mock.calls[0] ?? []
    expect(message).toBe('Beekeeper could not save its query cache to IndexedDB.')
  })

  it('writes the storage once for two saves of the same persisted queries', async () => {
    const setItem = vi.fn(() => Promise.resolve())
    const storage = { ...memoryStorage(), setItem }
    const persister = createQueryPersister(storage)
    const client = new QueryClient()
    client.setQueryData(['sessions', '-p'], ['a'])
    const save = (): Promise<void> =>
      Promise.resolve(
        persister.persistClient({
          timestamp: Date.now(),
          buster: 'b',
          clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery })
        })
      )
    await save()

    client.setQueryData(['session', '-p', 's1'], { id: 's1' })
    await save()

    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('saves and restores a client through the storage it is given', async () => {
    const persister = createQueryPersister(memoryStorage())

    await persister.persistClient(CLIENT)

    expect(await persister.restoreClient()).toEqual(CLIENT)
  })
})

describe('createQueryPersister restore', () => {
  const storageHolding = (value: string): Parameters<typeof createQueryPersister>[0] => ({
    getItem: () => Promise.resolve(value),
    setItem: () => Promise.resolve(),
    removeItem: () => Promise.resolve()
  })

  it('rejects with a fixed error that holds nothing of the stored text, and no cause', async () => {
    const persister = createQueryPersister(storageHolding('{"projects": secret transcript text'))

    const failure: unknown = await Promise.resolve(persister.restoreClient()).catch(
      (error: unknown) => error
    )

    expect(failure).toBeInstanceOf(Error)
    const error = failure as Error
    expect(error.message).toBe('Beekeeper could not read its saved query cache.')
    expect(error.cause).toBeUndefined()
    expect(`${error.message}${error.stack ?? ''}`).not.toContain('secret')
  })

  it('restores a well-formed saved cache', async () => {
    const persister = createQueryPersister(storageHolding(JSON.stringify(CLIENT)))

    expect(await persister.restoreClient()).toEqual(CLIENT)
  })
})

describe('createQueryPersister round trip', () => {
  it('restores a list whose background refetch failed as a success, with the old data', async () => {
    const client = new QueryClient()
    client.setQueryData(['projects'], [{ dirName: '-p' }])
    await client
      .fetchQuery({
        queryKey: ['projects'],
        queryFn: () => Promise.reject(new Error('refetch failed')),
        retry: false,
        staleTime: 0
      })
      .catch(() => undefined)
    expect(client.getQueryState(['projects'])?.status).toBe('error')
    const persister = createQueryPersister(memoryStorage())

    await persister.persistClient({
      timestamp: Date.now(),
      buster: 'b',
      clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery })
    })
    const restored = await persister.restoreClient()
    const next = new QueryClient()
    if (restored === undefined) throw new Error('nothing was restored')
    hydrate(next, restored.clientState)

    const restoredState = next.getQueryState(['projects'])
    expect(restoredState?.status).toBe('success')
    expect(restoredState?.error).toBeNull()
    expect(restoredState?.fetchFailureCount).toBe(0)
    expect(next.getQueryData(['projects'])).toEqual([{ dirName: '-p' }])
  })

  it('leaves a successful list as it is', async () => {
    const client = new QueryClient()
    client.setQueryData(['sessions', '-p'], ['a'])
    const persister = createQueryPersister(memoryStorage())

    await persister.persistClient({
      timestamp: Date.now(),
      buster: 'b',
      clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery })
    })
    const restored = await persister.restoreClient()
    const next = new QueryClient()
    if (restored === undefined) throw new Error('nothing was restored')
    hydrate(next, restored.clientState)

    expect(next.getQueryState(['sessions', '-p'])?.status).toBe('success')
    expect(next.getQueryData(['sessions', '-p'])).toEqual(['a'])
  })
})

describe('createQueryPersister restore of an aged cache', () => {
  const DAY_MS = 24 * 60 * 60 * 1000
  const START = Date.parse('2026-03-01T00:00:00.000Z')

  afterEach(() => {
    vi.useRealTimers()
  })

  it('drops a list that passed the maximum age since it was saved, and keeps a fresh one', async () => {
    // Only Date is faked: the persister's throttle needs real timers.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)
    const client = new QueryClient()
    client.setQueryData(['projects'], [{ dirName: '-old' }])
    vi.setSystemTime(START + 6 * DAY_MS)
    client.setQueryData(['sessions', '-p'], ['fresh'])
    const persister = createQueryPersister(memoryStorage())
    // Saved when the projects list is 6 days old and the sessions list is new.
    await persister.persistClient({
      timestamp: Date.now(),
      buster: 'b',
      clientState: dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery })
    })

    // Restored 3 days later: the projects list is now 9 days old.
    vi.setSystemTime(START + 9 * DAY_MS)
    const restored = await persister.restoreClient()
    const next = new QueryClient()
    if (restored === undefined) throw new Error('nothing was restored')
    hydrate(next, restored.clientState)

    expect(next.getQueryData(['projects'])).toBeUndefined()
    expect(next.getQueryData(['sessions', '-p'])).toEqual(['fresh'])
  })

  it('keeps every other field of the saved client', async () => {
    const storage = memoryStorage()
    const saved = {
      timestamp: 42,
      buster: 'the-buster',
      clientState: { mutations: [{ keep: 'me' }], queries: [] }
    }
    await storage.setItem('beekeeper-query-cache', JSON.stringify(saved))

    expect(await createQueryPersister(storage).restoreClient()).toEqual(saved)
  })

  it.each([
    ['no clientState', { timestamp: 1, buster: 'b' }],
    ['a clientState that is not an object', { timestamp: 1, buster: 'b', clientState: 'x' }],
    ['queries that are not an array', { timestamp: 1, buster: 'b', clientState: { queries: {} } }],
    [
      'a query with no state',
      { clientState: { queries: [{ queryKey: ['projects'], secret: 'transcript' }] } }
    ],
    [
      'a query whose key is not an array',
      { clientState: { queries: [{ queryKey: 'projects', state: { dataUpdatedAt: 1 } }] } }
    ],
    [
      'a query whose dataUpdatedAt is not a number',
      { clientState: { queries: [{ queryKey: ['projects'], state: { dataUpdatedAt: 'x' } }] } }
    ],
    ['a saved value that is not an object', 'secret transcript text']
  ])('rejects with the fixed error, and nothing from the input, for %s', async (_label, saved) => {
    const storage = memoryStorage()
    await storage.setItem('beekeeper-query-cache', JSON.stringify(saved))

    const failure: unknown = await Promise.resolve(
      createQueryPersister(storage).restoreClient()
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    const error = failure as Error
    expect(error.message).toBe('Beekeeper could not read its saved query cache.')
    expect(error.cause).toBeUndefined()
    expect(`${error.message}${error.stack ?? ''}`).not.toContain('transcript')
  })
})

describe('logPersistError', () => {
  it('logs one fixed message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logPersistError()

    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not restore its query cache from IndexedDB.'
    )
  })
})
