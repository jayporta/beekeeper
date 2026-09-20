import type { Dirent } from 'node:fs'
import type * as fsPromises from 'node:fs/promises'

/**
 * Mutable state shared between a test file's `node:fs/promises` mock
 * factory and its tests: a test sets `throwForDir` and `throwError` to
 * make one directory's `readdir` reject with a fixed error instead of
 * listing it, and clears `throwForDir` afterward.
 */
export interface ThrowingReaddirState {
  /** The directory whose `readdir` call should reject, or `undefined` for none. */
  throwForDir: string | undefined
  /** The error `readdir` rejects with, when `throwForDir` matches. */
  throwError: unknown
}

/**
 * Wraps a `readdir` implementation so calls for one targeted directory
 * reject with a fixed error instead of being listed. Lets a test prove how
 * a caller handles a `readdir` failure that isn't a missing-entry error,
 * without needing a real unreadable directory on disk.
 *
 * @param readdir - The `readdir` implementation to wrap.
 * @param state - Mutable state; see {@link ThrowingReaddirState}.
 * @returns A `readdir` replacement with the same signature.
 */
export function withThrowingReaddir(
  readdir: typeof fsPromises.readdir,
  state: ThrowingReaddirState
): typeof fsPromises.readdir {
  const wrapped = async (dir: string, options: { withFileTypes: true }): Promise<Dirent[]> => {
    if (dir === state.throwForDir) throw state.throwError
    return readdir(dir, options)
  }
  return wrapped as typeof fsPromises.readdir
}
