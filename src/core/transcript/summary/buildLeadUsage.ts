import { countedUsage } from '../../pricing/countedUsage'
import type { TokenCounts } from '../../pricing/tokenCounts'
import { QUARTER_HOUR_MS } from '../../shared/quarterHour'
import type { LeadUsage, LeadUsageSlot } from './leadUsage'

/** One message as the observer tracks it, merged across every record that carried its id. */
export interface TrackedMessage {
  /** The raw model id of the first record that carried the id. */
  readonly model: string
  /** The per-field maximum token counts across the message's records. */
  readonly tokens: TokenCounts
  /** The earliest record timestamp in epoch milliseconds, or `null` when no record had one. */
  readonly earliestMs: number | null
}

/** Options for {@link buildLeadUsage}. */
export interface BuildLeadUsageOptions {
  /** The tracked messages, keyed by message id. */
  readonly messages: ReadonlyMap<string, TrackedMessage>
  /** How many `assistant` records failed schema validation. */
  readonly invalidAssistantRecords: number
}

/**
 * Groups tracked messages into tokens per 15-minute UTC slot and model, with
 * the same rules the daily chart applies to a ledger: a message counts as
 * `countedUsage` decides, in the slot of its earliest record, and a counted
 * message with no timestamp is tallied as undated instead.
 *
 * @param options - The tracked messages and the invalid record count.
 * @returns The transcript's lead usage.
 */
export function buildLeadUsage(options: BuildLeadUsageOptions): LeadUsage {
  const { messages, invalidAssistantRecords } = options
  const bySlot = new Map<string, { slot: number; model: string; tokens: number }>()
  let undatedMessages = 0

  for (const message of messages.values()) {
    const counted = countedUsage(message)
    if (counted === null) continue
    if (message.earliestMs === null) {
      undatedMessages += 1
      continue
    }

    const slot = Math.floor(message.earliestMs / QUARTER_HOUR_MS)
    const key = `${slot}\0${counted.model}`
    const existing = bySlot.get(key)
    if (existing === undefined)
      bySlot.set(key, { slot, model: counted.model, tokens: counted.tokens })
    else existing.tokens += counted.tokens
  }

  const slots: LeadUsageSlot[] = [...bySlot.values()].sort(
    (a, b) => a.slot - b.slot || a.model.localeCompare(b.model)
  )
  return { slots, undatedMessages, invalidAssistantRecords, messageIds: new Set(messages.keys()) }
}
