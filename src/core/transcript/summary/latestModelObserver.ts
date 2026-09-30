import { isLabelWithinCap } from '../boundedLabel'
import { isRecordObject } from '../isRecordObject'
import { recordTimestampMs } from './recordTimestampMs'

/** The model Claude Code records on a response it generated itself, not the API. */
const SYNTHETIC_MODEL = '<synthetic>'

/** Tracks the model of the latest assistant record among the records it observes. */
export interface LatestModelObserver {
  /** Feeds one parsed record, in any order. Records that don't qualify are ignored. */
  observe(record: Record<string, unknown>): void
  /** The model of the qualifying record with the largest timestamp, or `null` when there was none. */
  model(): string | null
}

/**
 * Creates an observer that keeps the model of the assistant record with the
 * largest timestamp. Timestamps run backwards in file order, so line order
 * can't say which record is latest.
 *
 * A record qualifies when it is an `assistant` record with a parseable
 * timestamp and a non-empty string `message.model` within the label cap that
 * isn't `<synthetic>`. A record without a timestamp never qualifies, since it
 * can't be placed in time. On a tie the first record seen wins. Only the
 * current best model and its timestamp are held.
 *
 * @returns An observer ready to `observe` a transcript's records.
 */
export function createLatestModelObserver(): LatestModelObserver {
  let model: string | null = null
  let latestMs: number | null = null

  return {
    observe(record) {
      if (record.type !== 'assistant' || !isRecordObject(record.message)) return

      const candidate = record.message.model
      if (!isLabelWithinCap(candidate) || candidate === '' || candidate === SYNTHETIC_MODEL) return

      const timestampMs = recordTimestampMs(record)
      if (timestampMs === null) return
      if (latestMs === null || timestampMs > latestMs) {
        latestMs = timestampMs
        model = candidate
      }
    },
    model: () => model
  }
}
