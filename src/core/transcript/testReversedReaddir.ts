import type { Dirent } from 'node:fs'
import type * as fsPromises from 'node:fs/promises'
import { compareCodeUnits } from './compareCodeUnits'

/**
 * Mutable state shared between a test file's `node:fs/promises` mock
 * factory and its tests, which set `reverseListingFor` per test.
 */
export interface ReversedReaddirState {
  /** The directory whose listing order should be forced descending, or `undefined` for none. */
  reverseListingFor: string | undefined
}

/**
 * Builds a `node:fs/promises` module replacement whose `readdir` calls
 * through to the real implementation and then, for one targeted directory,
 * returns its entries sorted by code unit descending: a fixed, deliberately
 * unsorted order regardless of what the OS or filesystem actually returns
 * (which on some filesystems already happens to come back sorted). Lets a
 * test prove a discovery function's sort actually runs.
 *
 * @param actual - The real `node:fs/promises` module, from a `vi.mock`
 * factory's `importOriginal`.
 * @param state - Mutable state; a test sets `reverseListingFor` before
 * calling the code under test, and clears it afterward.
 * @returns A module object suitable to return from a `vi.mock` factory.
 */
export function buildReversedReaddirModule(
  actual: typeof fsPromises,
  state: ReversedReaddirState
): typeof fsPromises {
  const readdirWithForcedOrder = async (
    dir: string,
    options: { withFileTypes: true }
  ): Promise<Dirent[]> => {
    const entries = await actual.readdir(dir, options)
    if (dir !== state.reverseListingFor) return entries
    return [...entries].sort((a, b) => compareCodeUnits(b.name, a.name))
  }

  return { ...actual, readdir: readdirWithForcedOrder as typeof actual.readdir }
}
