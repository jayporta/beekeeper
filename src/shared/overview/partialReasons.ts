import {
  ALL_FIGURES,
  FIGURES_AFFECTED_BY_COUNT,
  countReasonsOf,
  figuresMarkedBy,
  type CountReason,
  type PartialFigure
} from './countReasons'
import type { AggregateTotals } from './sumTotals'

export type { PartialFigure }

/** One reason a total may be low. The footnote gives them in this order. */
export type PartialReason = 'loading' | 'failed' | CountReason

/** The figures each reason leaves low. A folder missing from the sum touches every figure. */
const FIGURES_AFFECTED: Readonly<Record<PartialReason, readonly PartialFigure[]>> = {
  loading: ALL_FIGURES,
  failed: ALL_FIGURES,
  ...FIGURES_AFFECTED_BY_COUNT
}

/**
 * Names why a sum is partial.
 *
 * @param totals - The sum.
 * @returns The reasons that apply, in footnote order. Empty when the sum is complete.
 */
export function partialReasonsOf(totals: AggregateTotals): readonly PartialReason[] {
  const { partial, folders } = totals
  return [
    ...(folders.loading > 0 ? (['loading'] as const) : []),
    ...(folders.failed > 0 ? (['failed'] as const) : []),
    ...countReasonsOf(partial)
  ]
}

/**
 * Which figures of a sum may be low, so each gets the partial marker. A reason
 * marks only the figures it affects: a session with no recorded cost leaves
 * the tokens complete.
 *
 * @param totals - The sum.
 * @returns For each figure, `true` when a reason that applies leaves it low.
 */
export function partialFiguresOf(
  totals: AggregateTotals
): Readonly<Record<PartialFigure, boolean>> {
  return figuresMarkedBy(partialReasonsOf(totals), FIGURES_AFFECTED)
}
