import { combineTokenCounts, type TokenCounts } from '../../pricing/tokenCounts'
import { tokenClasses } from '../../pricing/tokenClasses'
import { messageTokens } from '../messageTokens'
import { assistantRecordSchema } from '../schemas'

/** Totals the tokens a transcript's own assistant records report. */
export interface TranscriptTokenObserver {
  /** Feeds one parsed record; anything but a valid `assistant` record is ignored. */
  observe(record: Record<string, unknown>): void
  /**
   * The total across every token class, or `null` when no valid assistant
   * usage was seen or the sum is not finite.
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
 * Holds one entry per distinct message id in the transcript, each id capped
 * by the schema's identifier bound, and lives only for one scan.
 *
 * @returns An observer ready to `observe` a transcript's records.
 */
export function createTranscriptTokenObserver(): TranscriptTokenObserver {
  const byMessageId = new Map<string, TokenCounts>()

  return {
    observe(record) {
      if (record.type !== 'assistant') return
      const parsed = assistantRecordSchema.safeParse(record)
      if (!parsed.success) return

      const { message } = parsed.data
      const tokens = messageTokens(message.usage)
      const existing = byMessageId.get(message.id)
      byMessageId.set(
        message.id,
        existing === undefined ? tokens : combineTokenCounts([existing, tokens], Math.max)
      )
    },
    total() {
      if (byMessageId.size === 0) return null
      let total = 0
      for (const counts of byMessageId.values()) {
        for (const tokenClass of tokenClasses) total += counts[tokenClass]
      }
      return Number.isFinite(total) ? total : null
    }
  }
}
