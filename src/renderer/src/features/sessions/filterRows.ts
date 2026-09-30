import { sessionLabel } from './sessionLabel'
import type { SessionRow } from './sessionRow'

function matches(row: SessionRow, needle: string): boolean {
  return sessionLabel(row.item).text.toLowerCase().includes(needle)
}

/**
 * Keeps the rows that match a search, by a case-insensitive substring of the
 * session's label. A lead stays when it or any of its teammates match, and
 * only its matching teammates are kept under it.
 *
 * @param rows - The top-level rows from `groupSessionRows`.
 * @param query - The search text. Blank keeps every row.
 * @returns The matching rows.
 */
export function filterRows(rows: readonly SessionRow[], query: string): readonly SessionRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return rows

  return rows.flatMap((row) => {
    const teammates = row.teammates.filter((teammate) => matches(teammate, needle))
    return matches(row, needle) || teammates.length > 0 ? [{ ...row, teammates }] : []
  })
}
