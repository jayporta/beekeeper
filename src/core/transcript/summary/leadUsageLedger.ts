import { countedUsage } from '../../pricing/countedUsage'
import type { TokenCounts } from '../../pricing/tokenCounts'
import { totalTokenCount } from '../../pricing/totalTokenCount'
import { QUARTER_HOUR_MS } from '../../shared/quarterHour'
import type { LeadUsageSlot } from './leadUsage'

/**
 * The weight, in UTF-16 code units, charged for each slot and model the ledger
 * holds beyond its key: the map entry, the key's string header, the running
 * sum, and its frozen copy in the list `slots()` returns.
 */
export const LEDGER_SLOT_OVERHEAD = 80

/** One message as the observer tracks it, merged across every record that carried its id. */
export interface TrackedMessage {
  /** The raw model id of the first record that carried the id. */
  readonly model: string
  /** The per-field maximum token counts across the message's records. */
  readonly tokens: TokenCounts
  /** The earliest record timestamp in epoch milliseconds, or `null` when no record had one. */
  readonly earliestMs: number | null
}

/** Options for {@link LeadUsageLedger.update}. */
export interface LeadUsageUpdate {
  /** The message as the ledger last saw it, or `undefined` for a message it has not seen. */
  readonly before: TrackedMessage | undefined
  /** The message now. */
  readonly after: TrackedMessage
}

/** Tokens per 15-minute UTC slot and model, and the totals beside them, kept up to date message by message. */
export interface LeadUsageLedger {
  /**
   * Replaces a message's contribution with its current one, so the slots and
   * totals stay as if they were worked out again from every message.
   * @param update - The message as the ledger last saw it, and as it is now.
   */
  update(update: LeadUsageUpdate): void
  /**
   * The usage by slot and model, sorted by slot then model, with the rules the
   * daily chart applies to a ledger: a message counts as `countedUsage`
   * decides, in the slot of its earliest record. The list is not touched by
   * later updates.
   */
  slots(): readonly LeadUsageSlot[]
  /** How many counted messages have no timestamp, so are in no slot. */
  undatedMessages(): number
  /** The total across every token class of every message, or `null` when it is not finite. */
  totalTokens(): number | null
  /**
   * What the ledger holds, in UTF-16 code units: {@link LEDGER_SLOT_OVERHEAD}
   * plus the length of the key, the slot and the model, for each slot and model.
   */
  weight(): number
}

/** One slot and model as the ledger sums it. */
interface SlotSum {
  readonly slot: number
  readonly model: string
  tokens: number
  messages: number
}

/** Where one message's counted tokens belong. */
type Placement =
  | { readonly kind: 'none' }
  | { readonly kind: 'undated' }
  | {
      readonly kind: 'slot'
      readonly slot: number
      readonly model: string
      readonly tokens: number
    }

function placementOf(message: TrackedMessage): Placement {
  const counted = countedUsage(message)
  if (counted === null) return { kind: 'none' }
  if (message.earliestMs === null) return { kind: 'undated' }
  return {
    kind: 'slot',
    slot: Math.floor(message.earliestMs / QUARTER_HOUR_MS),
    model: counted.model,
    tokens: counted.tokens
  }
}

/**
 * Creates a ledger of lead usage that takes each change to a message as it
 * happens, so reading it costs the number of slots rather than the number of
 * messages. A message's tokens only grow and its earliest timestamp only
 * moves earlier, but the ledger doesn't rely on it: every update takes the
 * old contribution out and puts the new one in.
 *
 * @returns An empty ledger.
 */
export function createLeadUsageLedger(): LeadUsageLedger {
  const bySlot = new Map<string, SlotSum>()
  let undated = 0
  let finiteTotal = 0
  let nonFiniteMessages = 0
  let sorted: readonly LeadUsageSlot[] | null = null
  let weight = 0

  function place(placement: Placement, sign: 1 | -1): void {
    if (placement.kind === 'none') return
    if (placement.kind === 'undated') {
      undated += sign
      return
    }

    sorted = null
    const key = `${placement.slot}\0${placement.model}`
    const existing = bySlot.get(key)
    if (existing === undefined) {
      weight += LEDGER_SLOT_OVERHEAD + key.length
      bySlot.set(key, {
        slot: placement.slot,
        model: placement.model,
        tokens: placement.tokens,
        messages: 1
      })
      return
    }
    existing.tokens += sign * placement.tokens
    existing.messages += sign
    if (existing.messages === 0) {
      bySlot.delete(key)
      weight -= LEDGER_SLOT_OVERHEAD + key.length
    }
  }

  function count(message: TrackedMessage, sign: 1 | -1): void {
    const total = totalTokenCount(message.tokens)
    if (Number.isFinite(total)) finiteTotal += sign * total
    else nonFiniteMessages += sign
  }

  return {
    update({ before, after }) {
      if (before !== undefined) {
        count(before, -1)
        place(placementOf(before), -1)
      }
      count(after, 1)
      place(placementOf(after), 1)
    },
    slots() {
      sorted ??= Object.freeze(
        [...bySlot.values()]
          .map(({ slot, model, tokens }) => Object.freeze({ slot, model, tokens }))
          .sort((a, b) => a.slot - b.slot || a.model.localeCompare(b.model))
      )
      return sorted
    },
    undatedMessages: () => undated,
    totalTokens: () =>
      nonFiniteMessages > 0 || !Number.isFinite(finiteTotal) ? null : finiteTotal,
    weight: () => weight
  }
}
