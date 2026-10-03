import { labelFromCwd } from './labelFromCwd'
import { readRecords } from './readRecords'

/** How many lines at the head of a transcript are searched for a `cwd`. */
export const MAX_HEAD_LINES = 20

/** The longest line read, in UTF-16 code units. A longer head line is skipped. */
const MAX_HEAD_LINE_CHARS = 1024 * 1024

/**
 * Labels a transcript by the working directory it records. Reads only the
 * first {@link MAX_HEAD_LINES} lines, counting skipped ones, and stops at
 * the first record whose `cwd` is a string, closing the file.
 *
 * @param transcriptPath - Absolute path to a `.jsonl` transcript.
 * @returns The label from the first recorded `cwd` (see {@link labelFromCwd}),
 * or `null` when no head line records one or its label is unusable. Never
 * carries the `cwd` itself.
 * @throws {Error} When the transcript cannot be opened or read.
 */
export async function readCwdLabel(transcriptPath: string): Promise<string | null> {
  let linesRead = 0
  for await (const record of readRecords(transcriptPath, { maxLineChars: MAX_HEAD_LINE_CHARS })) {
    if (linesRead++ === MAX_HEAD_LINES) return null
    if (!record.ok) continue
    const cwd = record.value.cwd
    if (typeof cwd === 'string') return labelFromCwd(cwd)
  }
  return null
}
