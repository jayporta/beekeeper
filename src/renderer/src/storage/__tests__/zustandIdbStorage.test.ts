import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { idbStorage } from '../idbStorage'
import { zustandIdbStorage } from '../zustandIdbStorage'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('zustandIdbStorage', () => {
  it('reads back what it wrote', async () => {
    await zustandIdbStorage.setItem('zustand-round-trip', 'value')

    expect(await zustandIdbStorage.getItem('zustand-round-trip')).toBe('value')
    await zustandIdbStorage.removeItem('zustand-round-trip')
    expect(await zustandIdbStorage.getItem('zustand-round-trip')).toBeNull()
  })

  it('resolves when a write fails, logging a message that names only the key', async () => {
    vi.spyOn(idbStorage, 'setItem').mockRejectedValue(new Error('quota exceeded'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(zustandIdbStorage.setItem('some-key', 'secret value')).resolves.toBeUndefined()

    expect(log).toHaveBeenCalledExactlyOnceWith('Beekeeper could not save "some-key" to IndexedDB.')
  })

  it('resolves when a delete fails, logging a message that names only the key', async () => {
    vi.spyOn(idbStorage, 'removeItem').mockRejectedValue(new Error('blocked'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(zustandIdbStorage.removeItem('some-key')).resolves.toBeUndefined()

    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not remove "some-key" from IndexedDB.'
    )
  })

  it('logs a failed read and rethrows it, for Zustand to handle', async () => {
    vi.spyOn(idbStorage, 'getItem').mockRejectedValue(new Error('unavailable'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(zustandIdbStorage.getItem('some-key')).rejects.toThrow('unavailable')

    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not read "some-key" from IndexedDB.'
    )
  })
})
