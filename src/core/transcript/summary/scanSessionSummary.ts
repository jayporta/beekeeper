import { createLastCostState } from '../lastCostState'
import type { ReadJsonlLinesOptions } from '../readJsonlLines'
import { readRecords } from '../readRecords'
import { aiTitleRecordSchema } from '../schemas'
import { recordTimestampMs } from './recordTimestampMs'
import type { ActivitySpan, RecordedCost, SessionSummary } from './sessionSummary'
import { truncateTitle } from './truncateTitle'

/**
 * Reads a transcript once and reports what a sessions list needs to show:
 * its title, its recorded cost, and the span its records cover.
 *
 * Every line is parsed. A substring prefilter ahead of `JSON.parse` was
 * measured against real transcripts and skips 1.4% of their bytes, so
 * scanning for the substring costs more than parsing the lines it saves.
 * The title and the cost state are the last valid record of their type by
 * line order, since neither carries a timestamp and a session rewrites
 * both as it runs. The activity span is the smallest and largest timestamp
 * found, not the first and last lines, because timestamps within a
 * transcript run backwards.
 *
 * Only what the summary displays is kept: the title is capped at a
 * displayable length and the cost state is reduced to its total, so an
 * oversized or padded record can't sit in the summary cache for as long as
 * the app runs.
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
  let title: string | null = null
  const lastCostState = createLastCostState()
  let earliestMs: number | null = null
  let latestMs: number | null = null
  let skippedLines = 0

  for await (const result of readRecords(filePath, options)) {
    if (!result.ok) {
      skippedLines += 1
      continue
    }

    const record = result.value
    const timestampMs = recordTimestampMs(record)
    if (timestampMs !== null) {
      if (earliestMs === null || timestampMs < earliestMs) earliestMs = timestampMs
      if (latestMs === null || timestampMs > latestMs) latestMs = timestampMs
    }

    lastCostState.observe(record)
    if (record.type === 'ai-title') {
      const aiTitle = aiTitleRecordSchema.safeParse(record)
      if (aiTitle.success) title = truncateTitle(aiTitle.data.aiTitle)
    }
  }

  const costState = lastCostState.latest()
  const cost: RecordedCost | null = costState ? { totalUSD: costState.totalCostUSD ?? null } : null

  const activity: ActivitySpan | null =
    earliestMs === null || latestMs === null ? null : { earliestMs, latestMs }

  return { title, cost, activity, skippedLines }
}
