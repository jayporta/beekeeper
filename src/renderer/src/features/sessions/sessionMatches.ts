import type { SessionRow } from './sessionRow'

/**
 * Prepares search text for matching: trimmed and lowercased.
 *
 * @param query - The text typed in the search box.
 * @returns The text to match against, empty when the search is blank.
 */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

/**
 * Whether a session's label contains the search text, ignoring case.
 *
 * @param row - The row to test.
 * @param needle - Search text from {@link normalizeQuery}.
 * @returns `true` when the row's own label matches. Its teammates are not considered.
 */
export function rowMatches(row: SessionRow, needle: string): boolean {
  return row.label.text.toLowerCase().includes(needle)
}
