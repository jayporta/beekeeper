import { combineTokenCounts, type TokenCounts } from '../pricing/tokenCounts'
import type { Usage, UsageEntry } from '../transcript/schemas'

/**
 * Converts one assistant message's usage into token counts.
 *
 * Sums `iterations` when it has more than one entry, since a multi-call
 * response's top-level counts don't include the per-call breakdown;
 * otherwise uses the top-level snapshot. Cache-write tokens come from the
 * 5-minute/1-hour split in `cache_creation` when present; when it's absent
 * but an unsplit `cache_creation_input_tokens` total is, the whole total
 * counts as 5-minute (defensive only, since every record on disk splits).
 *
 * @param usage - The validated usage object from an assistant message.
 * @returns The message's token counts across every billing class.
 */
export function messageTokens(usage: Usage): TokenCounts {
  const iterations = usage.iterations
  if (!iterations || iterations.length <= 1) return usageEntryTokens(usage)

  return iterations
    .map(usageEntryTokens)
    .reduce((sum, entryTokens) => combineTokenCounts([sum, entryTokens], (a, b) => a + b))
}

function usageEntryTokens(entry: UsageEntry): TokenCounts {
  const [cacheWrite5m, cacheWrite1h] = entryCacheWriteTokens(entry)
  return {
    input: entry.input_tokens,
    output: entry.output_tokens,
    cacheRead: entry.cache_read_input_tokens ?? 0,
    cacheWrite5m,
    cacheWrite1h
  }
}

/**
 * Reads one usage entry's cache-write tokens, split by retention tier.
 * @param entry - The usage entry to read cache-write tokens from.
 * @returns A `[cacheWrite5m, cacheWrite1h]` tuple.
 */
function entryCacheWriteTokens(entry: UsageEntry): [number, number] {
  if (entry.cache_creation) {
    return [
      entry.cache_creation.ephemeral_5m_input_tokens ?? 0,
      entry.cache_creation.ephemeral_1h_input_tokens ?? 0
    ]
  }
  return [entry.cache_creation_input_tokens ?? 0, 0]
}
