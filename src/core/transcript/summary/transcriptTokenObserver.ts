import { combineTokenCounts, type TokenCounts } from '../../pricing/tokenCounts'
import { totalTokenCount } from '../../pricing/totalTokenCount'
import { messageTokens } from '../messageTokens'
import { assistantRecordSchema } from '../schemas'

/** The most distinct message ids an observer tracks before it gives up on a transcript. */
export const MAX_MESSAGE_IDS = 50_000

/** Totals the tokens a transcript's own assistant records report. */
export interface TranscriptTokenObserver {
  /** Feeds one parsed record; anything but a valid `assistant` record is ignored. */
  observe(record: Record<string, unknown>): void
  /**
   * The total across every token class, or `null` when no valid assistant
   * usage was seen, the sum is not finite, or the transcript held more than
   * {@link MAX_MESSAGE_IDS} distinct message ids.
   */
  total(): number | null
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
 * Holds at most {@link MAX_MESSAGE_IDS} entries, one per distinct message id,
 * each id capped by the schema's identifier bound, and lives only for one
 * scan. A transcript with more distinct ids is not totaled: the observer
 * drops what it holds, ignores the rest of the records, and `total()` returns
 * `null`.
 *
 * @returns An observer ready to `observe` a transcript's records.
 */
export function createTranscriptTokenObserver(): TranscriptTokenObserver {
  const byMessageId = new Map<string, TokenCounts>()
  let overflowed = false

  return {
    observe(record) {
      if (overflowed || record.type !== 'assistant') return
      const parsed = assistantRecordSchema.safeParse(record)
      if (!parsed.success) return

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
        existing === undefined ? tokens : combineTokenCounts([existing, tokens], Math.max)
      )
    },
    total() {
      if (byMessageId.size === 0) return null
      let total = 0
      for (const counts of byMessageId.values()) total += totalTokenCount(counts)
      return Number.isFinite(total) ? total : null
    }
  }
}
