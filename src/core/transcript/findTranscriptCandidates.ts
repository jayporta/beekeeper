import { resolve } from 'node:path'
import { compareCodeUnits } from '../shared/compareCodeUnits'
import { readDirentsOrEmpty } from './readDirentsOrEmpty'
import { SESSION_TRANSCRIPT_PATTERN } from './sessionTranscriptName'

/** How many transcripts {@link findTranscriptCandidates} returns at most. */
export const MAX_TRANSCRIPT_CANDIDATES = 3

/**
 * Picks the few session transcripts a project is labeled from: the first in
 * name order, not the newest.
 *
 * Considers the same files session discovery lists: top-level regular files
 * named for a session id. `Dirent` never follows symlinks, so a symlink is
 * ignored, as is a file in a subfolder. No file is stat'd or opened.
 *
 * @param projectPath - The project folder. A relative path is resolved
 * against the working directory.
 * @returns Up to {@link MAX_TRANSCRIPT_CANDIDATES} file names, the first in
 * name order, or `[]` when the folder is missing or holds no transcript.
 * @throws {Error} When the folder cannot be read for a reason other than
 * being missing.
 */
export async function findTranscriptCandidates(projectPath: string): Promise<string[]> {
  const dirents = await readDirentsOrEmpty(resolve(projectPath))
  return dirents
    .filter((dirent) => dirent.isFile() && SESSION_TRANSCRIPT_PATTERN.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort(compareCodeUnits)
    .slice(0, MAX_TRANSCRIPT_CANDIDATES)
}
