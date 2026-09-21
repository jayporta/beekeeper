import { priceTokens, type PriceTokensResult } from '../pricing/priceTokens'
import { combineTokenCounts, type TokenCounts } from '../pricing/tokenCounts'
import type { LedgerEntry } from './usageLedger'

/** One agent's token usage for one raw model id and resolved billing speed. */
export interface TokenGroup {
  /** The raw model id exactly as recorded, before normalization. */
  readonly model: string
  /**
   * The resolved billing speed: `'standard'` when no message in this group
   * ever carried an explicit speed, otherwise the speed as narrowed by the
   * usage schema (a bounded string, or the `'unknown'` sentinel).
   */
  readonly speed: string
  /** The group's token counts, summed across every message in it. */
  readonly tokens: TokenCounts
  /** The group's price. */
  readonly price: PriceTokensResult
}

/**
 * Groups one agent's ledger entries by raw model id and resolved billing
 * speed, summing each group's token counts and pricing the result. An
 * absent speed resolves to `'standard'`, so a message that never stated
 * its speed groups with one that explicitly did, rather than showing as a
 * separate bucket.
 *
 * @param entries - The ledger entries owned by one agent.
 * @returns The agent's token usage, one entry per (model, speed) pair.
 */
export function groupTokensByModelAndSpeed(entries: readonly LedgerEntry[]): readonly TokenGroup[] {
  const byKey = new Map<string, { model: string; speed: string; tokens: TokenCounts }>()

  for (const entry of entries) {
    const speed = resolveDisplaySpeed(entry.speed)
    const key = `${entry.model}\u0000${speed}`
    const existing = byKey.get(key)

    byKey.set(key, {
      model: entry.model,
      speed,
      tokens: existing
        ? combineTokenCounts([existing.tokens, entry.tokens], (a, b) => a + b)
        : entry.tokens
    })
  }

  return [...byKey.values()].map((group) => ({
    ...group,
    price: priceTokens({ model: group.model, speed: group.speed, tokens: group.tokens })
  }))
}

function resolveDisplaySpeed(speed: string | undefined): string {
  return speed ?? 'standard'
}
