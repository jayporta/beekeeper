import { normalizeQuery, rowMatches } from './sessionMatches'
import type { SessionRow } from './sessionRow'

/**
 * Keeps the rows that match a search, by a case-insensitive substring of the
 * session's label. A lead stays when it or any of its teammates match, and
 * only its matching teammates are kept under it. A row whose teammates all
 * match is returned as the same object, so its identity survives a keystroke.
 *
 * @param rows - The top-level rows from `groupSessionRows`.
 * @param query - The search text. Blank keeps every row.
 * @returns The matching rows.
 */
export function filterRows(rows: readonly SessionRow[], query: string): readonly SessionRow[] {
  const needle = normalizeQuery(query)
  if (needle === '') return rows

  return rows.flatMap((row) => {
    const teammates = row.teammates.filter((teammate) => rowMatches(teammate, needle))
    if (!rowMatches(row, needle) && teammates.length === 0) return []
    return teammates.length === row.teammates.length ? [row] : [{ ...row, teammates }]
  })
}
