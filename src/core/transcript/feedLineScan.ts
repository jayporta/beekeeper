import type { Result } from '../shared/result'
import type { ReadJsonlLinesOptions } from './readJsonlLines'
import { readRecords, type SkippedLineError } from './readRecords'

/** One transcript line as the reader reports it: a record, or why it could not be read as one. */
export type LineScanInput = Result<Record<string, unknown>, SkippedLineError>

/** A fold over a transcript's lines that a cache can keep and size. */
export interface LineScan {
  /**
   * Folds in the next line of the transcript, in file order.
   * @param input - The line, as `readRecords` reports it.
   */
  observe(input: LineScanInput): void
  /**
   * What the scan holds in memory, in UTF-16 code units, for bounding how
   * many scans a cache keeps.
   */
  weight(): number
}

/** Options for {@link feedLineScan}. */
export interface FeedLineScanOptions extends ReadJsonlLinesOptions {
  /** Absolute path to the `.jsonl` transcript to read. */
  readonly filePath: string
}

/**
 * Reads a transcript's lines into a scan, from `start` (the beginning, by
 * default) to the last complete line. Pass a `cursor` to learn where the
 * read stopped, and later read on from that offset with `start`.
 *
 * @param scan - The scan to fold the lines into.
 * @param options - The file, where to start, and stream tuning, as
 * {@link readRecords} takes them.
 * @throws {Error} When the file does not exist or cannot be read. The scan
 * then holds the lines read before the failure, and its cursor stopped
 * where they ended.
 */
export async function feedLineScan(scan: LineScan, options: FeedLineScanOptions): Promise<void> {
  const { filePath, ...readOptions } = options
  for await (const result of readRecords(filePath, readOptions)) scan.observe(result)
}
