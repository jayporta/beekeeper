import type { LruMap } from '../shared/lruMap'
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

/**
 * How long after its last modification, in milliseconds, a transcript still
 * counts as growing. Only a transcript modified within it has a scan kept to
 * carry on from; an older one is scanned in full, once, as it changes.
 */
export const RESUME_RECENT_MS = 10 * 60 * 1000

/**
 * How many scans of the same weight a cache's bound must hold for one to be
 * kept: a scan weighing more than the bound divided by this is read in full
 * each time instead. Without it a single heavy scan, which a weight-bounded
 * map stores by evicting everything older until it fits, would push out every
 * other session's scan, and two heavy sessions would evict each other on
 * every call.
 */
export const KEPT_SCAN_BOUND_SHARE = 4

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

/**
 * Whether a transcript still counts as growing: it was modified within
 * {@link RESUME_RECENT_MS} of now.
 *
 * @param file - The transcript, as discovery stat'd it.
 * @param now - The clock, in epoch milliseconds.
 * @returns Whether its last modification is within the window. A file dated in
 * the future counts as recent.
 */
export function isRecentlyModified(file: TranscriptFileInfo, now: () => number): boolean {
  return now() - file.mtimeMs <= RESUME_RECENT_MS
}

/** Options for {@link advanceScan}. */
export interface AdvanceScanOptions<S extends LineScan> {
  /** The scans kept so far, by key. */
  readonly states: LruMap<string, ResumableScan<S>>
  /** What the transcript's scan is kept under. */
  readonly key: string
  /** The transcript, as discovery stat'd it. */
  readonly file: TranscriptFileInfo
  /** Makes a scan with nothing observed. */
  readonly createScan: () => S
  /**
   * Whether the transcript is still growing, which the caller decides, since
   * a caller may judge a group of transcripts together (see
   * {@link isRecentlyModified}). Only then is the scan kept.
   */
  readonly recent: boolean
  /** Stream tuning, mainly for tests. */
  readonly tuning?: ScanReadTuning
}

/**
 * Brings a transcript's scan up to date: the kept scan is carried on when it
 * can be (see {@link resumeScan}), and a new one reads the file from its first
 * byte otherwise. The kept scan leaves `states` first, so a failure along the
 * way leaves none behind, since it may hold only some of the new lines.
 *
 * Only a recent transcript has its scan kept, and read for the mark that
 * recognizes it later. Any other is scanned in full with no scan retained and
 * no extra open, so a project with many idle sessions pays nothing for
 * resuming. A scan weighing more than
 * `1 / KEPT_SCAN_BOUND_SHARE` of the bound is returned but not kept, as
 * {@link KEPT_SCAN_BOUND_SHARE} explains, so the next call reads that
 * transcript in full.
 *
 * @param options - The scans kept, the key, the transcript, how to make a
 * scan, whether it is recent and stream tuning.
 * @returns The scan, holding every complete line of the file. It is the one
 * kept in `states` when the file is recent, so later calls carry it on.
 * @throws {Error} When the file cannot be read, carrying the system error code.
 */
export async function advanceScan<S extends LineScan>(options: AdvanceScanOptions<S>): Promise<S> {
  const { states, key, file, createScan, recent, tuning } = options
  const previous = states.get(key)
  states.delete(key)

  if (!recent) {
    const scan = createScan()
    await feedLineScan(scan, { ...tuning, filePath: file.path })
    return scan
  }

  const resumed =
    previous === undefined ? null : await resumeScan({ file, resume: previous, tuning })
  const next = resumed ?? (await startScan({ file, scan: createScan(), tuning }))
  if (resumableScanWeight(next) * KEPT_SCAN_BOUND_SHARE <= states.maxWeight) {
    states.set(key, next)
  }
  return next.scan
}
