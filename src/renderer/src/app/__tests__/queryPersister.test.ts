import 'fake-indexeddb/auto'
import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryPersister, logPersistError } from '../queryPersister'
import { shouldPersistQuery } from '../shouldPersistQuery'

afterEach(() => {
  vi.restoreAllMocks()
})

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

  it('saves and restores a client through the storage it is given', async () => {
    const stored = new Map<string, string>()
    const storage = {
      getItem: (key: string) => Promise.resolve(stored.get(key) ?? null),
      setItem: (key: string, value: string) => Promise.resolve(void stored.set(key, value)),
      removeItem: (key: string) => Promise.resolve(void stored.delete(key))
    }
    const persister = createQueryPersister(storage)

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
  const memoryStorage = (): Parameters<typeof createQueryPersister>[0] => {
    const stored = new Map<string, string>()
    return {
      getItem: (key) => Promise.resolve(stored.get(key) ?? null),
      setItem: (key, value) => Promise.resolve(void stored.set(key, value)),
      removeItem: (key) => Promise.resolve(void stored.delete(key))
    }
  }

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

describe('logPersistError', () => {
  it('logs one fixed message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logPersistError()

    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not restore its query cache from IndexedDB.'
    )
  })
})
