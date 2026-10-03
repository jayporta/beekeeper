import { join, resolve } from 'node:path'
import { compareCodeUnits } from '../shared/compareCodeUnits'
import { captureSystemError } from './captureSystemError'
import { readDirentsOrEmpty } from './readDirentsOrEmpty'
import { SESSION_TRANSCRIPT_PATTERN } from './sessionTranscriptName'
import { statTranscriptFile, type TranscriptFileInfo } from './statTranscriptFile'

/**
 * Finds the session transcript in a project folder that was modified last.
 *
 * Considers the same files session discovery lists: top-level regular files
 * named for a session id. A symlink or a file in a subfolder is ignored. A
 * transcript that cannot be stat'd is skipped, so one unreadable file does
 * not hide the rest. Files are stat'd one at a time.
 *
 * @param projectPath - The project folder. A relative path is resolved
 * against the working directory.
 * @returns The newest transcript, the one with the lower file name on a tie,
 * or `null` when the folder is missing or holds no transcript.
 * @throws {Error} When the folder cannot be read for a reason other than
 * being missing.
 */
export async function findNewestTranscript(
  projectPath: string
): Promise<TranscriptFileInfo | null> {
  const projectDir = resolve(projectPath)
  const dirents = await readDirentsOrEmpty(projectDir)
  const names = dirents
    .filter((dirent) => dirent.isFile() && SESSION_TRANSCRIPT_PATTERN.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort(compareCodeUnits)

  let newest: TranscriptFileInfo | null = null
  for (const name of names) {
    const stat = await captureSystemError(() => statTranscriptFile(join(projectDir, name)))
    if (!stat.ok || stat.value === null) continue
    if (newest === null || stat.value.mtimeMs > newest.mtimeMs) newest = stat.value
  }
  return newest
}
