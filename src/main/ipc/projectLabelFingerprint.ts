import { lstat } from 'node:fs/promises'
import { join } from 'node:path'
import { captureSystemError } from '../../core/transcript/captureSystemError'
import { statTranscriptFile } from '../../core/transcript/statTranscriptFile'

/**
 * Reads a project folder's modification time, which changes when a transcript
 * is added or removed.
 *
 * @param folderPath - The project folder.
 * @returns The folder's `mtimeMs`.
 * @throws {Error} When the folder cannot be stat'd.
 */
export async function readFolderMtime(folderPath: string): Promise<number> {
  return (await lstat(folderPath)).mtimeMs
}

/**
 * Describes the state of some of a project's transcripts as one string: each
 * file's name, modification time, and size, or just its name when it cannot
 * be stat'd. Two calls return the same string while none of them changed.
 *
 * @param folderPath - The project folder.
 * @param names - The transcript file names to describe, in order.
 * @returns The description.
 */
export async function stampTranscripts(
  folderPath: string,
  names: readonly string[]
): Promise<string> {
  const stamps: (string | number | null)[][] = []
  for (const name of names) {
    const stat = await captureSystemError(() => statTranscriptFile(join(folderPath, name)))
    stamps.push(
      stat.ok && stat.value !== null ? [name, stat.value.mtimeMs, stat.value.size] : [name, null]
    )
  }
  return JSON.stringify(stamps)
}

/**
 * Joins a folder's modification time and its transcripts' stamps into the
 * fingerprint a cached `null` label is retried against.
 *
 * @param folderMtimeMs - The folder's modification time.
 * @param stamps - The result of {@link stampTranscripts}.
 * @returns The fingerprint.
 */
export function fingerprintOf(folderMtimeMs: number, stamps: string): string {
  return `${folderMtimeMs}:${stamps}`
}
