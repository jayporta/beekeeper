import type { AggregateTotals } from './sumTotals'

/** Why a total may be low. The order of the list is the order the footnote gives them in. */
export const PARTIAL_REASONS = [
  'loading',
  'failed',
  'unreadable',
  'withoutTokens',
  'withoutCost',
  'lowTokens',
  'undated'
] as const

/** One reason a total may be low. */
export type PartialReason = (typeof PARTIAL_REASONS)[number]

/**
 * Names why a sum is partial.
 *
 * @param totals - The sum.
 * @returns The reasons that apply, in footnote order. Empty when the sum is complete.
 */
export function partialReasonsOf(totals: AggregateTotals): readonly PartialReason[] {
  const { partial, folders } = totals
  const applies: Readonly<Record<PartialReason, boolean>> = {
    loading: folders.loading > 0,
    failed: folders.failed > 0,
    unreadable: partial.unreadable > 0,
    withoutTokens: partial.withoutTokens > 0,
    withoutCost: partial.withoutCost > 0,
    lowTokens: partial.lowTokens > 0,
    undated: partial.undated > 0
  }
  return PARTIAL_REASONS.filter((reason) => applies[reason])
}
