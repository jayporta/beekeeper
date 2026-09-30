import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactErrorHandlers } from '../reactErrorHandlers'

afterEach(() => {
  vi.restoreAllMocks()
})

const SECRET = new Error('secret transcript text')
const INFO = { componentStack: 'at Secret' }

/** Calls a handler the way React does, with the error and its info. */
const raise = (handler: (...args: unknown[]) => void): void => {
  handler(SECRET, INFO)
}

describe('reactErrorHandlers', () => {
  it.each([
    ['onCaughtError', () => raise(reactErrorHandlers.onCaughtError)],
    ['onUncaughtError', () => raise(reactErrorHandlers.onUncaughtError)],
    ['onRecoverableError', () => raise(reactErrorHandlers.onRecoverableError)]
  ])('%s logs one fixed message and nothing from the error', (_name, call) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    call()

    expect(log).toHaveBeenCalledTimes(1)
    const args = log.mock.calls[0] ?? []
    expect(args).toHaveLength(1)
    expect(String(args[0])).toMatch(/^Beekeeper /)
    expect(String(args[0])).not.toContain('secret')
  })

  it('uses a different message for each kind of error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    raise(reactErrorHandlers.onCaughtError)
    raise(reactErrorHandlers.onUncaughtError)
    raise(reactErrorHandlers.onRecoverableError)

    expect(new Set(log.mock.calls.map(([message]) => message)).size).toBe(3)
  })
})
