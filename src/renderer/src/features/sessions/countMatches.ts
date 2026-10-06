import { normalizeQuery, rowMatches } from './sessionMatches'
import type { SessionRow } from './sessionRow'

/**
 * Counts the sessions whose label, or whose own subagents' name, description or
 * type, match a search, leads and teammates alike.
 * A lead shown only because one of its teammates matches is not counted.
 *
 * @param rows - The top-level rows from `groupSessionRows`, unfiltered.
 * @param query - The search text.
 * @returns How many sessions match. A blank search matches every session.
 */
export function countMatches(rows: readonly SessionRow[], query: string): number {
  const needle = normalizeQuery(query)
  let count = 0
  for (const row of rows) {
    if (rowMatches(row, needle)) count += 1
    for (const teammate of row.teammates) if (rowMatches(teammate, needle)) count += 1
  }
  return count
}
