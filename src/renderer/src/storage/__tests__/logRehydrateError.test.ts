import { afterEach, describe, expect, it, vi } from 'vitest'
import { logRehydrateError } from '../logRehydrateError'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logRehydrateError', () => {
  it('logs one fixed message naming only the key when rehydration fails', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logRehydrateError('some-key')()(undefined, new SyntaxError('Unexpected token s in secret'))

    expect(log).toHaveBeenCalledExactlyOnceWith(
      'Beekeeper could not restore "some-key" from IndexedDB.'
    )
  })

  it('logs nothing when rehydration succeeds', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    logRehydrateError('some-key')()({ dismissed: true }, undefined)

    expect(log).not.toHaveBeenCalled()
  })
})
