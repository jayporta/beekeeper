import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TranscriptFileInfo } from '../statTranscriptFile'

/** A throwaway directory of synthetic transcripts, and how to remove it. */
export interface TranscriptDir {
  /** The directory's path, created fresh under the OS temp directory. */
  readonly root: string
  /**
   * Writes a transcript and reports it the way discovery would.
   *
   * @param name - The transcript's filename within the directory.
   * @param content - The synthetic JSONL to write, verbatim.
   * @returns The file's path, modification time, and size.
   */
  readonly write: (name: string, content: string) => TranscriptFileInfo
  /** Removes the directory and everything in it. */
  readonly cleanup: () => void
}

/**
 * Creates a fresh temp directory for summary tests to write synthetic
 * transcripts into, so no test touches a real `~/.claude`.
 *
 * @returns The directory, a `write` that stats what it wrote, and `cleanup`.
 */
export function createTranscriptDir(): TranscriptDir {
  const root = mkdtempSync(join(tmpdir(), 'beekeeper-summary-'))

  return {
    root,
    write(name: string, content: string): TranscriptFileInfo {
      const path = join(root, name)
      writeFileSync(path, content, 'utf-8')
      const stats = statSync(path)
      return { path, mtimeMs: stats.mtimeMs, size: stats.size }
    },
    cleanup: () => rmSync(root, { recursive: true, force: true })
  }
}
