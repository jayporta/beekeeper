import type { LineScan } from '../feedLineScan'
import { createSessionRoleObserver } from '../sessionRoleObserver'
import { aiTitleRecordSchema } from '../schemas'
import { createSignalObserver } from '../signals/signalObserver'
import { summarizeSignals } from '../signals/summarizeSignals'
import { createTeammateSpawnObserver } from '../teammateSpawnObserver'
import { createLatestModelObserver } from './latestModelObserver'
import { createLimitHitObserver } from './limitHitObserver'
import { createRecordedCostState } from './recordedCostState'
import { recordTimestampMs } from './recordTimestampMs'
import type { ActivitySpan, RecordedUsage, SessionSummary } from './sessionSummary'
import { createTranscriptTokenObserver } from './transcriptTokenObserver'
import { truncateTitle } from './truncateTitle'

/**
 * The weight, in UTF-16 code units, a scan carries before any record: the
 * title, model, role labels and plan limit it keeps, each bounded, and the
 * objects that hold them.
 */
export const SUMMARY_SCAN_BASE_WEIGHT = 2048

/** A transcript summary built up one line at a time, and readable at any point. */
export interface SummaryScan extends LineScan {
  /**
   * The summary of every line observed so far. Reading it leaves the scan
   * as it was, so more lines can follow, and the result shares no state with
   * the scan, so later lines never change a summary already returned.
   */
  summary(): SessionSummary
  /**
   * What the scan holds in memory, in UTF-16 code units: {@link SUMMARY_SCAN_BASE_WEIGHT}
   * plus what its token, signal, teammate and cost state observers hold.
   */
  weight(): number
}

/**
 * Creates the fold behind {@link scanSessionSummary}: it keeps what a
 * sessions list shows about a transcript, line by line. Feeding it a file's
 * lines in order gives the summary of the whole file, and feeding it the
 * lines after those it has already seen gives the same summary as a scan of
 * the longer file from the start.
 *
 * The title and the recorded usage are the last valid record of their type
 * by line order. The usage comes from a {@link createRecordedCostState}, which
 * keeps the last valid `cost-state` reduced and weighed, so a crafted record
 * never sits in a cached scan unweighed.
 *
 * @returns A scan with nothing observed.
 */
export function createSummaryScan(): SummaryScan {
  let title: string | null = null
  const costState = createRecordedCostState()
  const roleObserver = createSessionRoleObserver()
  const teammateObserver = createTeammateSpawnObserver()
  const modelObserver = createLatestModelObserver()
  const limitHitObserver = createLimitHitObserver()
  const tokenObserver = createTranscriptTokenObserver()
  const signalObserver = createSignalObserver()
  let earliestMs: number | null = null
  let latestMs: number | null = null
  let skippedLines = 0

  return {
    observe(input) {
      if (!input.ok) {
        skippedLines += 1
        return
      }

      const record = input.value
      const timestampMs = recordTimestampMs(record)
      if (timestampMs !== null) {
        if (earliestMs === null || timestampMs < earliestMs) earliestMs = timestampMs
        if (latestMs === null || timestampMs > latestMs) latestMs = timestampMs
      }

      roleObserver.observe(record)
      teammateObserver.observe(record)
      limitHitObserver.observe(record)
      modelObserver.observe(record, timestampMs)
      tokenObserver.observe(record, timestampMs)
      signalObserver.observe(record, timestampMs)
      costState.observe(record)
      if (record.type === 'ai-title') {
        const aiTitle = aiTitleRecordSchema.safeParse(record)
        if (aiTitle.success) title = truncateTitle(aiTitle.data.aiTitle)
      }
    },
    summary() {
      const activity: ActivitySpan | null =
        earliestMs === null || latestMs === null ? null : { earliestMs, latestMs }
      const recorded = costState.latest()
      const usage: RecordedUsage | null =
        recorded === null
          ? null
          : { totalUSD: recorded.totalCostUSD ?? null, totalTokens: costState.totalTokens() }

      return {
        title,
        usage,
        activity,
        skippedLines,
        role: roleObserver.role(),
        teamSpawns: teammateObserver.result(),
        model: modelObserver.model(),
        limitHit: limitHitObserver.latest(),
        transcriptTokens: tokenObserver.total(),
        leadUsage: tokenObserver.leadUsage(),
        signals: summarizeSignals(signalObserver.events(), { partial: signalObserver.capped() })
      }
    },
    weight: () =>
      SUMMARY_SCAN_BASE_WEIGHT +
      tokenObserver.weight() +
      signalObserver.weight() +
      teammateObserver.weight() +
      costState.weight()
  }
}
