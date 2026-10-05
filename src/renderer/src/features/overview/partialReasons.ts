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

/** A figure on the overview that a partial sum can leave low. */
export type PartialFigure = 'tokens' | 'cost' | 'counts'

const ALL_FIGURES = ['tokens', 'cost', 'counts'] as const satisfies readonly PartialFigure[]

/**
 * The figures each reason leaves low. A folder missing from the sum, an
 * unreadable session, and a session that is dated by its file's write time
 * (so may belong outside the window) touch every figure. The rest touch the
 * one figure they name.
 */
const FIGURES_AFFECTED: Readonly<Record<PartialReason, readonly PartialFigure[]>> = {
  loading: ALL_FIGURES,
  failed: ALL_FIGURES,
  unreadable: ALL_FIGURES,
  withoutTokens: ['tokens'],
  withoutCost: ['cost'],
  lowTokens: ['tokens'],
  undated: ALL_FIGURES
}

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

/**
 * Whether one figure of a sum may be low, so it gets the partial marker. A
 * reason marks only the figures it affects: a session with no recorded cost
 * leaves the tokens complete.
 *
 * @param totals - The sum.
 * @param figure - The figure to check.
 * @returns `true` when a reason that applies leaves the figure low.
 */
export function isPartialFor(totals: AggregateTotals, figure: PartialFigure): boolean {
  return partialReasonsOf(totals).some((reason) => FIGURES_AFFECTED[reason].includes(figure))
}
