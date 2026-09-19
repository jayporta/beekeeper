import { lstat } from 'node:fs/promises'
import { isMissingEntryError } from './isMissingEntryError'

/**
 * Reports whether a path is a real, on-disk directory. Uses `lstat`, so a
 * symlink at `path`, even one pointing at a directory, reports `false`
 * rather than being followed.
 *
 * @param path - The path to check.
 * @returns `true` when `path` exists and is a directory, `false` when it
 * does not exist or is something else.
 * @throws {Error} When `path` cannot be stat'd for a reason other than
 * being missing.
 */
export async function isRealDirectory(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path)
    return stats.isDirectory()
  } catch (error) {
    if (isMissingEntryError(error)) return false
    throw error
  }
}
