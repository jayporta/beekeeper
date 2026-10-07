import { partialFiguresOf } from './partialReasons'
import { totalsStatus, type AggregateTotals } from './sumTotals'

/**
 * Whether a sidebar figure shows, with the "~" that says its tokens may be low.
 *
 * @param totals - What the sidebar row adds up to.
 * @returns `true` when the figure is on screen and its tokens may be low.
 */
export function showsMayBeLow(totals: AggregateTotals): boolean {
  return totalsStatus(totals) === 'ready' && partialFiguresOf(totals).tokens
}
