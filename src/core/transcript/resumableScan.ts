import { feedLineScan, type LineScan } from './feedLineScan'
import type { ReadCursor, ReadJsonlLinesOptions } from './readJsonlLines'
import type { TranscriptFileInfo } from './statTranscriptFile'
import { confirmTailMark, readTailMark, type TailMark } from './tailMark'

/**
 * The weight, in UTF-16 code units, charged for each resumable scan beyond
 * its scan and prefix: the record, the numbers it holds and the transcript
 * path it is keyed by.
 */
export const RESUME_ENTRY_OVERHEAD = 512

/** The stream tuning a scan read takes: the parts of the reader's options that are not about where to read. */
export type ScanReadTuning = Pick<ReadJsonlLinesOptions, 'highWaterMark' | 'maxLineChars'>

/**
 * A transcript scan that can carry on where it stopped: the scan itself, how
 * far into the file it got, and what the file looked like then.
 */
export interface ResumableScan<S extends LineScan> {
  /** The file's modification time when the scan last read it. */
  readonly mtimeMs: number
  /** The size the file was stat'd at when the scan last read it. */
  readonly size: number
  /** The byte offset the scan consumed through, which is where a line begins. May be past `size`, when the file grew during the scan. */
  readonly offset: number
  /** How the file began and where it lived, to tell it is still the same file. */
  readonly mark: TailMark
  /** The lines consumed so far. */
  readonly scan: S
}

/** Options for {@link startScan}. */
export interface StartScanOptions<S extends LineScan> {
  /** The transcript, as discovery stat'd it. */
  readonly file: TranscriptFileInfo
  /** A scan with nothing observed, to read the file into. */
  readonly scan: S
  /** Stream tuning, mainly for tests. */
  readonly tuning?: ScanReadTuning
}

/** Options for {@link resumeScan}. */
export interface ResumeScanOptions<S extends LineScan> {
  /** The transcript, as discovery stat'd it. */
  readonly file: TranscriptFileInfo
  /** The scan to carry on. */
  readonly resume: ResumableScan<S>
  /** Stream tuning, mainly for tests. */
  readonly tuning?: ScanReadTuning
}

/**
 * Weighs a resumable scan for a cache's memory bound: the entry overhead,
 * what the scan holds, and the prefix the file is recognized by.
 *
 * @param resume - A resumable scan.
 * @returns The weight in UTF-16 code units.
 */
export function resumableScanWeight(resume: ResumableScan<LineScan>): number {
  return RESUME_ENTRY_OVERHEAD + resume.scan.weight() + Math.ceil(resume.mark.prefix.byteLength / 2)
}

/**
 * Reads a transcript from its first byte into a fresh scan.
 *
 * @param options - The transcript, the empty scan and stream tuning.
 * @returns The scan, resumable from where it stopped.
 * @throws {Error} When the file cannot be read, carrying the system error code.
 */
export async function startScan<S extends LineScan>(
  options: StartScanOptions<S>
): Promise<ResumableScan<S>> {
  const { file, scan, tuning } = options
  const mark = await readTailMark(file)
  const cursor: ReadCursor = { offset: 0 }
  await feedLineScan(scan, { ...tuning, filePath: file.path, cursor })
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
export async function resumeScan<S extends LineScan>(
  options: ResumeScanOptions<S>
): Promise<ResumableScan<S> | null> {
  const { file, resume, tuning } = options
  const grew = file.size > resume.size && file.size >= resume.offset
  if (!grew || file.mtimeMs === resume.mtimeMs) return null

  const mark = await confirmTailMark({ file, mark: resume.mark, offset: resume.offset })
  if (mark === null) return null

  const cursor: ReadCursor = { offset: resume.offset }
  const readOptions = { ...tuning, filePath: file.path, start: resume.offset, cursor }
  await feedLineScan(resume.scan, readOptions)
  return { mtimeMs: file.mtimeMs, size: file.size, offset: cursor.offset, mark, scan: resume.scan }
}
