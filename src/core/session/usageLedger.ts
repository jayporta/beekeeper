import { combineTokenCounts, type TokenCounts } from '../pricing/tokenCounts'
import { agentIdentityEquals, type AgentIdentity } from './agentIdentity'

/** One message's usage as tracked by the ledger. */
export interface LedgerEntry {
  /** The message id (`message.id`) this entry tracks. */
  readonly messageId: string
  /** The agent that owns this message: the first one to report its id. */
  readonly owner: AgentIdentity
  /** The message's raw model id, from the first record that reported it. */
  readonly model: string
  /**
   * The last explicitly present `speed` across every record for this
   * message, or `undefined` when none ever carried one.
   */
  readonly speed: string | undefined
  /** The message's token counts, the per-field max across every record its owner reported. */
  readonly tokens: TokenCounts
  /** The earliest timestamp, in epoch milliseconds, across every record its owner reported, or `null` when none had one. */
  readonly earliestMs: number | null
  /** The latest timestamp, in epoch milliseconds, across every record its owner reported, or `null` when none had one. */
  readonly latestMs: number | null
}

/** One agent's report of a message's usage from a single transcript record. */
export interface MessageReport {
  /** The reporting agent. */
  readonly identity: AgentIdentity
  /** The message id (`message.id`) this report is for. */
  readonly messageId: string
  /** The message's raw model id, as recorded. */
  readonly model: string
  /** The record's speed, already narrowed by the usage schema (`undefined` when absent). */
  readonly speed: string | undefined
  /** The record's token counts. */
  readonly tokens: TokenCounts
  /** The record's own timestamp in epoch milliseconds, or `null` when it has none or it isn't a date. */
  readonly timestampMs: number | null
}

/**
 * Tracks per-message usage across every agent's transcript in one session,
 * so a message forked into more than one transcript (a subagent copying
 * the lead's context) is credited to exactly one agent: whichever reports
 * it first.
 */
export interface UsageLedger {
  /**
   * Records one agent's report of a message. The first report of a
   * message id becomes its owner. A later report from a different agent
   * updates nothing; a later report from the same owner merges in by
   * per-field token max, widens the tracked timestamp span, and updates the
   * tracked speed when the new report carries one explicitly.
   */
  report(messageReport: MessageReport): void
  /** Every message the ledger has seen, in first-reported order. */
  entries(): readonly LedgerEntry[]
}

/** Lifts `pick` to optional timestamps: a `null` gives way to the other value. */
function ignoringNull(
  pick: (a: number, b: number) => number
): (a: number | null, b: number | null) => number | null {
  return (a, b) => (a === null ? b : b === null ? a : pick(a, b))
}

const earlierTimestamp = ignoringNull(Math.min)
const laterTimestamp = ignoringNull(Math.max)

/**
 * Creates an empty {@link UsageLedger}.
 * @returns A new, empty ledger.
 */
export function createUsageLedger(): UsageLedger {
  const byMessageId = new Map<string, LedgerEntry>()

  return {
    report(messageReport) {
      const existing = byMessageId.get(messageReport.messageId)

      if (existing === undefined) {
        byMessageId.set(messageReport.messageId, {
          messageId: messageReport.messageId,
          owner: messageReport.identity,
          model: messageReport.model,
          speed: messageReport.speed,
          tokens: messageReport.tokens,
          earliestMs: messageReport.timestampMs,
          latestMs: messageReport.timestampMs
        })
        return
      }

      if (!agentIdentityEquals(existing.owner, messageReport.identity)) return

      byMessageId.set(messageReport.messageId, {
        messageId: existing.messageId,
        owner: existing.owner,
        model: existing.model,
        speed: messageReport.speed ?? existing.speed,
        tokens: combineTokenCounts([existing.tokens, messageReport.tokens], Math.max),
        earliestMs: earlierTimestamp(existing.earliestMs, messageReport.timestampMs),
        latestMs: laterTimestamp(existing.latestMs, messageReport.timestampMs)
      })
    },
    entries() {
      return [...byMessageId.values()]
    }
  }
}
