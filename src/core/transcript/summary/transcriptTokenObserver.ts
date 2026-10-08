import { combineTokenCounts } from '../../pricing/tokenCounts'
import { totalTokenCount } from '../../pricing/totalTokenCount'
import { earlierTimestamp } from '../../shared/optionalTimestamps'
import { messageTokens } from '../messageTokens'
import { assistantRecordSchema } from '../schemas'
import { buildLeadUsage, type TrackedMessage } from './buildLeadUsage'
import type { LeadUsage } from './leadUsage'

/** The most distinct message ids an observer tracks before it gives up on a transcript. */
export const MAX_MESSAGE_IDS = 50_000

/** Totals and slots the tokens a transcript's own assistant records report. */
export interface TranscriptTokenObserver {
  /**
   * Feeds one parsed record; anything but a valid `assistant` record is ignored.
   * @param record - The parsed record.
   * @param timestampMs - The record's own timestamp in epoch milliseconds, or `null` when it has none.
   */
  observe(record: Record<string, unknown>, timestampMs: number | null): void
  /**
   * The total across every token class, or `null` when no valid assistant
   * usage was seen, the sum is not finite, or the transcript held more than
   * {@link MAX_MESSAGE_IDS} distinct message ids.
   */
  total(): number | null
  /**
   * The transcript's usage by 15-minute slot and model, its message ids and
   * its invalid assistant record count. Empty, not `null`, when the
   * transcript held no valid assistant record, and `null` only when it held
   * more than {@link MAX_MESSAGE_IDS} distinct message ids.
   */
  leadUsage(): LeadUsage | null
}

/**
 * Creates an observer that totals the tokens a transcript's assistant
 * records report, counting each message id once however many records carry
 * it: records sharing an id merge by per-field maximum, as the full scan's
 * usage ledger does. Sidechain and `<synthetic>` records are included, as
 * the full scan credits them to the transcript's agent.
 *
 * A record that fails schema validation is skipped silently and is not a
 * skipped line, since the summary scan doesn't count schema failures. The
 * total is what this transcript file reports, not necessarily what the
 * session spent: a resumed or forked transcript can hold copied records,
 * which the full scan counts per file the same way.
 *
 * Each message also keeps the model of the first record that carried its id
 * and the earliest record timestamp, which `leadUsage()` groups by slot. An
 * `assistant` record that fails schema validation is counted in
 * `invalidAssistantRecords` for the full scan's skipped-line rule.
 *
 * Holds at most {@link MAX_MESSAGE_IDS} entries, one per distinct message id,
 * each id capped by the schema's identifier bound, and lives only for one
 * scan. A transcript with more distinct ids is not totaled: the observer
 * drops what it holds, ignores the rest of the records, and both `total()`
 * and `leadUsage()` return `null`.
 *
 * @returns An observer ready to `observe` a transcript's records.
 */
export function createTranscriptTokenObserver(): TranscriptTokenObserver {
  const byMessageId = new Map<string, TrackedMessage>()
  let invalidAssistantRecords = 0
  let overflowed = false

  return {
    observe(record, timestampMs) {
      if (overflowed || record.type !== 'assistant') return
      const parsed = assistantRecordSchema.safeParse(record)
      if (!parsed.success) {
        invalidAssistantRecords += 1
        return
      }

      const { message } = parsed.data
      const existing = byMessageId.get(message.id)
      if (existing === undefined && byMessageId.size >= MAX_MESSAGE_IDS) {
        byMessageId.clear()
        overflowed = true
        return
      }
      const tokens = messageTokens(message.usage)
      byMessageId.set(
        message.id,
        existing === undefined
          ? { model: message.model, tokens, earliestMs: timestampMs }
          : {
              model: existing.model,
              tokens: combineTokenCounts([existing.tokens, tokens], Math.max),
              earliestMs: earlierTimestamp(existing.earliestMs, timestampMs)
            }
      )
    },
    total() {
      if (byMessageId.size === 0) return null
      let total = 0
      for (const message of byMessageId.values()) total += totalTokenCount(message.tokens)
      return Number.isFinite(total) ? total : null
    },
    leadUsage() {
      return overflowed ? null : buildLeadUsage({ messages: byMessageId, invalidAssistantRecords })
    }
  }
}
