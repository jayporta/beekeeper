import type { FileStat } from '../io/fileSystemPort'
import { fileSystem } from '../io/installFileSystem'
import { isMissingEntryError } from '../shared/isMissingEntryError'

/** A transcript file's location, size and identity on disk, as reported by `lstat`. */
export interface TranscriptFileInfo {
  /** The file's absolute path. */
  readonly path: string
  /** The file's last-modified time, in milliseconds since the Unix epoch. */
  readonly mtimeMs: number
  /** The file's size in bytes. */
  readonly size: number
  /** The file's inode number, which a file replaced at the same path does not share. */
  readonly ino: number
  /** The id of the device the file lives on. */
  readonly dev: number
}

/**
 * Stats a transcript candidate for discovery.
 * @param filePath - Absolute path to the candidate transcript file.
 * @returns The file's info, or `null` when it is no longer a regular file,
 * or it disappeared after being listed.
 * @throws {Error} When `lstat` fails for a reason other than the entry
 * being missing.
 */
export async function statTranscriptFile(filePath: string): Promise<TranscriptFileInfo | null> {
  let stats: FileStat
  try {
    stats = await fileSystem().lstat(filePath)
  } catch (error) {
    if (isMissingEntryError(error)) return null
    throw error
  }
  if (stats.kind !== 'file') return null
  return {
    path: filePath,
    mtimeMs: stats.mtimeMs,
    size: stats.size,
    ino: stats.ino,
    dev: stats.dev
  }
}
