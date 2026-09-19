import type { Stats } from 'node:fs'
import { lstat } from 'node:fs/promises'
import { isMissingEntryError } from './isMissingEntryError'

/** A transcript file's location and size on disk, as reported by `lstat`. */
export interface TranscriptFileInfo {
  /** The file's absolute path. */
  readonly path: string
  /** The file's last-modified time, in milliseconds since the Unix epoch. */
  readonly mtimeMs: number
  /** The file's size in bytes. */
  readonly size: number
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
  let stats: Stats
  try {
    stats = await lstat(filePath)
  } catch (error) {
    if (isMissingEntryError(error)) return null
    throw error
  }
  if (!stats.isFile()) return null
  return { path: filePath, mtimeMs: stats.mtimeMs, size: stats.size }
}
