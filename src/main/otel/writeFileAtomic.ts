import { randomBytes } from 'node:crypto'
import { rename, rm, writeFile } from 'node:fs/promises'

/**
 * Writes a file so a reader sees either the old content or the new, never a
 * partial write. The text goes to a new owner-only temporary file beside the
 * target, which then replaces the target by rename.
 *
 * @param filePath - The file to write.
 * @param text - The UTF-8 content.
 * @throws When the write or the rename fails. The temporary file is removed first.
 */
export async function writeFileAtomic(filePath: string, text: string): Promise<void> {
  const tempPath = `${filePath}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await writeFile(tempPath, text, { mode: 0o600 })
    await rename(tempPath, filePath)
  } catch (error) {
    await rm(tempPath, { force: true })
    throw error
  }
}
