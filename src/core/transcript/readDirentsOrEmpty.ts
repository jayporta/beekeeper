import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { isMissingEntryError } from './isMissingEntryError'

/**
 * Lists a directory's entries with file-type info, tolerating a directory
 * that doesn't exist.
 *
 * @param dir - The directory to list.
 * @returns The directory's entries, or `[]` when `dir` does not exist or a
 * path component of it is not a directory.
 * @throws {Error} When `dir` cannot be read for a reason other than being
 * missing.
 */
export async function readDirentsOrEmpty(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (isMissingEntryError(error)) return []
    throw error
  }
}
