import type { CostStateRecord } from '../schemas'

/**
 * Totals the tokens a `cost-state` record holds: input, output, cache read
 * and cache write, across every model in its `modelUsage`. A missing field
 * counts as zero, as Claude Code omits fields between versions, and an empty
 * `modelUsage` totals zero. `thinkingTokens` is part of `outputTokens`, so it
 * is not added.
 *
 * @param costState - A validated `cost-state` record.
 * @returns The total, or `null` when the record has no `modelUsage` or the
 * sum is not finite.
 */
export function recordedTokenTotal(costState: CostStateRecord): number | null {
  if (costState.modelUsage === undefined) return null
  let total = 0
  for (const usage of Object.values(costState.modelUsage)) {
    total +=
      (usage.inputTokens ?? 0) +
      (usage.outputTokens ?? 0) +
      (usage.cacheReadInputTokens ?? 0) +
      (usage.cacheCreationInputTokens ?? 0)
  }
  return Number.isFinite(total) ? total : null
}
