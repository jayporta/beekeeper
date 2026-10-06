import { normalizeQuery, rowMatches } from './sessionMatches'
import type { SessionRow } from './sessionRow'

/**
 * Keeps the rows that match a search, by a case-insensitive substring of the
 * session's label or of the name, description or type of any of its own
 * subagents. A lead stays when it or any of its teammates match, and it
 * keeps every one of its teammates, so a card can show all its chips and
 * highlight the matching ones.
 *
 * @param rows - The top-level rows from `groupSessionRows`.
 * @param query - The search text. Blank keeps every row.
 * @returns The matching rows.
 */
export function filterRows(rows: readonly SessionRow[], query: string): readonly SessionRow[] {
  const needle = normalizeQuery(query)
  if (needle === '') return rows

  return rows.filter(
    (row) =>
      rowMatches(row, needle) || row.teammates.some((teammate) => rowMatches(teammate, needle))
  )
}
