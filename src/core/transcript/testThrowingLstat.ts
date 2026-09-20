import type { Stats } from 'node:fs'
import type * as fsPromises from 'node:fs/promises'

/**
 * Mutable state shared between a test file's `node:fs/promises` mock
 * factory and its tests: a test sets `throwForPath` and `throwError` to
 * make one path's `lstat` reject with a fixed error instead of stat'ing
 * it, and clears `throwForPath` afterward.
 */
export interface ThrowingLstatState {
  /** The path whose `lstat` call should reject, or `undefined` for none. */
  throwForPath: string | undefined
  /** The error `lstat` rejects with, when `throwForPath` matches. */
  throwError: unknown
}

/**
 * Wraps an `lstat` implementation so calls for one targeted path reject
 * with a fixed error instead of stat'ing it. Lets a test prove how a
 * caller handles an `lstat` failure that isn't a missing-entry error,
 * without needing a real unreadable path on disk.
 *
 * @param lstat - The `lstat` implementation to wrap.
 * @param state - Mutable state; see {@link ThrowingLstatState}.
 * @returns An `lstat` replacement with the same signature.
 */
export function withThrowingLstat(
  lstat: typeof fsPromises.lstat,
  state: ThrowingLstatState
): typeof fsPromises.lstat {
  const wrapped = async (path: string): Promise<Stats> => {
    if (path === state.throwForPath) throw state.throwError
    return lstat(path)
  }
  return wrapped as typeof fsPromises.lstat
}
