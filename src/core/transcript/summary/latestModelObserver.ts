import { isRecordObject } from '../isRecordObject'
import { MAX_IDENTIFIER_CODE_UNITS } from '../schemas/boundedIdentifier'
import { isWithinCodeUnits } from '../../shared/isWithinCodeUnits'

/** The model Claude Code records on a response it generated itself, not the API. */
const SYNTHETIC_MODEL = '<synthetic>'

/** Tracks the model of the latest assistant record among the records it observes. */
export interface LatestModelObserver {
  /**
   * Feeds one parsed record, in any order. Records that don't qualify are ignored.
   * @param record - The parsed record.
   * @param timestampMs - The record's timestamp in epoch milliseconds, already read by the caller, or `null` when it has none.
   */
  observe(record: Record<string, unknown>, timestampMs: number | null): void
  /** The model of the qualifying record with the largest timestamp, or `null` when there was none. */
  model(): string | null
}

/**
 * Creates an observer that keeps the model of the assistant record with the
 * largest timestamp. Timestamps run backwards in file order, so line order
 * can't say which record is latest.
 *
 * A record qualifies when it is an `assistant` record outside a sidechain,
 * since a subagent's record is not the lead's, with a timestamp and a
 * non-empty string `message.model` within the identifier cap that isn't
 * `<synthetic>`. A record without a timestamp never qualifies, since it can't
 * be placed in time. On a tie the first record seen wins. Only the
 * current best model and its timestamp are held.
 *
 * @returns An observer ready to `observe` a transcript's records.
 */
export function createLatestModelObserver(): LatestModelObserver {
  let model: string | null = null
  let latestMs: number | null = null

  return {
    observe(record, timestampMs) {
      if (record.type !== 'assistant' || record.isSidechain === true) return
      if (timestampMs === null || !isRecordObject(record.message)) return

      const candidate = record.message.model
      if (!isWithinCodeUnits(candidate, MAX_IDENTIFIER_CODE_UNITS)) return
      if (candidate === '' || candidate === SYNTHETIC_MODEL) return
      if (latestMs === null || timestampMs > latestMs) {
        latestMs = timestampMs
        model = candidate
      }
    },
    model: () => model
  }
}
