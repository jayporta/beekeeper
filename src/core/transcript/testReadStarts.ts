import * as fs from 'node:fs'
import { vi } from 'vitest'

/**
 * Where each transcript read began while `action` ran, in order, so a test
 * can tell a read that resumed (it began past byte 0) from a rescan (it began
 * at 0) and from a cache hit (there was no read).
 *
 * The test file must replace `createReadStream` in `node:fs` with a `vi.fn`
 * that calls through to the real one, using `vi.mock` and `importOriginal`.
 *
 * @param action - The work to run.
 * @returns The `start` offset of each stream opened, 0 for a read from the beginning.
 */
export async function startsDuring(action: () => Promise<unknown>): Promise<number[]> {
  const spy = vi.mocked(fs.createReadStream)
  const before = spy.mock.calls.length
  await action()
  return spy.mock.calls
    .slice(before)
    .map(([, options]) => (typeof options === 'object' ? (options.start ?? 0) : 0))
}
