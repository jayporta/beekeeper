import { statTranscriptFile, type TranscriptFileInfo } from './statTranscriptFile'

/**
 * Stats a transcript a test has just written, as discovery would.
 *
 * @param path - Absolute path to a file that exists.
 * @returns The file's info.
 * @throws {Error} When the path is not a regular file, which means the test's setup is wrong.
 */
export async function statWrittenTranscript(path: string): Promise<TranscriptFileInfo> {
  const info = await statTranscriptFile(path)
  if (info === null) throw new Error('Expected the fixture file to exist')
  return info
}
