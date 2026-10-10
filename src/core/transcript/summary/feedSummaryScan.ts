import type { ReadJsonlLinesOptions } from '../readJsonlLines'
import { readRecords } from '../readRecords'
import type { SummaryScan } from './summaryScan'

/** Options for {@link feedSummaryScan}. */
export interface FeedSummaryScanOptions extends ReadJsonlLinesOptions {
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
export async function feedSummaryScan(
  scan: SummaryScan,
  options: FeedSummaryScanOptions
): Promise<void> {
  const { filePath, ...readOptions } = options
  for await (const result of readRecords(filePath, readOptions)) scan.observe(result)
}
