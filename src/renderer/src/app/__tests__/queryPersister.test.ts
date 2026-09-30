import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createQueryPersister, logPersistError } from '../queryPersister'

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

describe('logPersistError', () => {
  it('logs one fixed message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logPersistError()

    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not restore its query cache from IndexedDB.'
    )
  })
})
