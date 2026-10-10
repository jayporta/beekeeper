import type { ReadJsonlLinesOptions } from '../readJsonlLines'
import { feedSummaryScan } from './feedSummaryScan'
import type { SessionSummary } from './sessionSummary'
import { createSummaryScan } from './summaryScan'

/**
 * Reads a transcript once and reports what a sessions list needs to show:
 * its title, its recorded usage, the tokens its own assistant records
 * report, the span its records cover, its model, and whether it is a lead or
 * a teammate agent session, and which teammates it spawned and stopped, and
 * the plan limit it hit, if any, its own assistant usage by 15-minute slot,
 * and its off-the-rails signal counts.
 *
 * The summary cache is shared with the overview's totals and daily-usage
 * scans, so the signal observer's per-record work and the signals each cached
 * summary holds are paid by those scans too.
 *
 * Every line is parsed. The title and the cost state are the last valid
 * record of their type by line order, since neither carries a timestamp
 * and a session rewrites both as it runs. The activity span is the
 * smallest and largest timestamp found, not the first and last lines,
 * because timestamps within a transcript run backwards. The model is the
 * latest one by timestamp, picked by `createLatestModelObserver`.
 *
 * Only what the summary displays is kept: the title is capped at a
 * displayable length, the model is bounded as an identifier, the cost
 * state is reduced to its USD and token totals, the role's agent type, name and team are capped
 * and dropped unless printable, and the spawn and stop lists hold only
 * those labels, deduplicated and capped, so an oversized or padded record
 * can't sit in the summary cache for as long as the app runs.
 *
 * A line the scan can't read as a record, whether it was too long to
 * buffer, wasn't valid JSON, or was valid JSON that isn't an object, is
 * counted in `skippedLines` and never logged. A final line with no
 * newline, as in a session still being written, isn't counted: the reader
 * drops it, since the rest of that record is still on its way.
 *
 * @param filePath - Absolute path to the `.jsonl` transcript to scan.
 * @param options - Stream tuning, mainly for tests.
 * @returns The session's summary.
 * @throws {Error} When `filePath` does not exist or cannot be read.
 */
export async function scanSessionSummary(
  filePath: string,
  options: ReadJsonlLinesOptions = {}
): Promise<SessionSummary> {
  const scan = createSummaryScan()
  await feedSummaryScan(scan, { ...options, filePath })
  return scan.summary()
}
