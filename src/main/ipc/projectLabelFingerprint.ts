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
 * Describes the state of some of a project's transcripts, one stamp per file:
 * its name, modification time, and size, or just its name when it cannot be
 * stat'd. A file's stamp stays the same while the file is unchanged.
 *
 * @param folderPath - The project folder.
 * @param names - The transcript file names to describe, in order.
 * @returns One stamp per name, in the same order.
 */
export async function stampTranscripts(
  folderPath: string,
  names: readonly string[]
): Promise<string[]> {
  const stamps: string[] = []
  for (const name of names) {
    const stat = await captureSystemError(() => statTranscriptFile(join(folderPath, name)))
    stamps.push(
      JSON.stringify(
        stat.ok && stat.value !== null ? [name, stat.value.mtimeMs, stat.value.size] : [name, null]
      )
    )
  }
  return stamps
}

/**
 * Joins a folder's modification time and its transcripts' stamps into the
 * fingerprint a cached label is checked against before it is reused.
 *
 * @param folderMtimeMs - The folder's modification time.
 * @param stamps - Stamps from {@link stampTranscripts}.
 * @returns The fingerprint.
 */
export function fingerprintOf(folderMtimeMs: number, stamps: readonly string[]): string {
  return `${folderMtimeMs}:[${stamps.join(',')}]`
}
