import type { ReadCursor, ReadJsonlLinesOptions } from '../readJsonlLines'
import type { TranscriptFileInfo } from '../statTranscriptFile'
import { confirmTailMark, readTailMark, type TailMark } from '../tailMark'
import { feedSummaryScan } from './feedSummaryScan'
import { createSummaryScan, type SummaryScan } from './summaryScan'

/**
 * The weight, in UTF-16 code units, charged for each resumable scan beyond
 * its scan and prefix: the record, the numbers it holds and the transcript
 * path it is keyed by.
 */
export const RESUME_ENTRY_OVERHEAD = 512

/** The stream tuning a summary read takes: the parts of the reader's options that are not about where to read. */
export type SummaryReadTuning = Pick<ReadJsonlLinesOptions, 'highWaterMark' | 'maxLineChars'>

/**
 * A transcript scan that can carry on where it stopped: the scan itself, how
 * far into the file it got, and what the file looked like then.
 */
export interface SummaryResume {
  /** The file's modification time when the scan last read it. */
  readonly mtimeMs: number
  /** The size the file was stat'd at when the scan last read it. */
  readonly size: number
  /** The byte offset the scan consumed through, which is where a line begins. May be past `size`, when the file grew during the scan. */
  readonly offset: number
  /** How the file began and where it lived, to tell it is still the same file. */
  readonly mark: TailMark
  /** The lines consumed so far. */
  readonly scan: SummaryScan
}

/** Options for {@link startSummaryScan} and {@link resumeSummaryScan}. */
export interface SummaryScanOptions {
  /** The transcript, as discovery stat'd it. */
  readonly file: TranscriptFileInfo
  /** Stream tuning, mainly for tests. */
  readonly tuning?: SummaryReadTuning
}

/** Options for {@link resumeSummaryScan}. */
export interface ResumeSummaryScanOptions extends SummaryScanOptions {
  /** The scan to carry on. */
  readonly resume: SummaryResume
}

/**
 * Weighs a resumable scan for the cache's memory bound: the entry overhead,
 * what the scan holds, and the prefix the file is recognized by.
 *
 * @param resume - A resumable scan.
 * @returns The weight in UTF-16 code units.
 */
export function resumeWeight(resume: SummaryResume): number {
  return RESUME_ENTRY_OVERHEAD + resume.scan.weight() + Math.ceil(resume.mark.prefix.byteLength / 2)
}

/**
 * Scans a transcript from its first byte.
 *
 * @param options - The transcript and stream tuning.
 * @returns The scan, resumable from where it stopped.
 * @throws {Error} When the file cannot be read, carrying the system error code.
 */
export async function startSummaryScan(options: SummaryScanOptions): Promise<SummaryResume> {
  const { file, tuning } = options
  const mark = await readTailMark(file)
  const scan = createSummaryScan()
  const cursor: ReadCursor = { offset: 0 }
  await feedSummaryScan(scan, { ...tuning, filePath: file.path, cursor })
  return { mtimeMs: file.mtimeMs, size: file.size, offset: cursor.offset, mark, scan }
}

/**
 * Carries a scan on over what a transcript gained since, when it is the same
 * file only longer. That needs its size to have grown past where the scan
 * stat'd it and to reach the offset the scan consumed, its modification time
 * to have changed, and {@link confirmTailMark} to find it unchanged where the
 * scan can tell. Anything else, such as a shrink, a rewrite or a replaced
 * file, returns `null` with the scan untouched, and the caller scans again
 * from the start.
 *
 * Once this starts reading, an error leaves `resume.scan` holding only some of
 * the new lines, so the caller must drop it.
 *
 * @param options - The transcript, the scan and stream tuning.
 * @returns The scan, carried on to the end of the file's complete lines, or
 * `null` when the file cannot be carried on from.
 * @throws {Error} When the file cannot be read, carrying the system error code.
 */
export async function resumeSummaryScan(
  options: ResumeSummaryScanOptions
): Promise<SummaryResume | null> {
  const { file, resume, tuning } = options
  const grew = file.size > resume.size && file.size >= resume.offset
  if (!grew || file.mtimeMs === resume.mtimeMs) return null

  const mark = await confirmTailMark({ file, mark: resume.mark, offset: resume.offset })
  if (mark === null) return null

  const cursor: ReadCursor = { offset: resume.offset }
  const readOptions = { ...tuning, filePath: file.path, start: resume.offset, cursor }
  await feedSummaryScan(resume.scan, readOptions)
  return { mtimeMs: file.mtimeMs, size: file.size, offset: cursor.offset, mark, scan: resume.scan }
}
