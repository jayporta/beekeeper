/**
 * The DOM id of a session's table row, so a disclosure button can name the
 * rows it controls.
 *
 * @param key - The session's key.
 * @returns The id, with the key percent-encoded so it holds no whitespace and
 *   stays a single entry in a space-separated `aria-controls` list.
 */
export function rowId(key: string): string {
  return `session-row-${encodeURIComponent(key)}`
}
