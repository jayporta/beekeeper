/**
 * The DOM id of a session's table row, so a disclosure button can name the
 * rows it controls.
 *
 * @param key - The session's key.
 * @returns The id.
 */
export function rowId(key: string): string {
  return `session-row-${key}`
}
