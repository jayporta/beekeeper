import { cardFigures } from './cardFigures'
import type { SessionRow } from './sessionRow'

/**
 * The most tokens any card shows: a lead's team total, or a session's own.
 * The card bars are drawn against it.
 *
 * @param rows - Every top-level row of the list, not only the ones a search shows, so bars don't change length while searching.
 * @returns The largest shown token count, or 0 when no card shows tokens.
 */
export function largestTokens(rows: readonly SessionRow[]): number {
  return rows.reduce((largest, { item }) => {
    const tokens = cardFigures(item).figures?.tokens ?? 0
    return tokens > largest ? tokens : largest
  }, 0)
}
