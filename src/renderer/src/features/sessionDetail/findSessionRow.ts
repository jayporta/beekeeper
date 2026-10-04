import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'

/**
 * Finds a session's row in a folder's grouped sessions list: a top-level row,
 * or a teammate nested under its lead.
 *
 * @param rows - The list's top-level rows.
 * @param ref - The session to find.
 * @returns The row, or `null` when the folder's list doesn't hold the session.
 */
export function findSessionRow(rows: readonly SessionRow[], ref: SessionRefDto): SessionRow | null {
  const key = sessionKey(ref)
  for (const row of rows) {
    if (row.key === key) return row
    const nested = row.teammates.find((teammate) => teammate.key === key)
    if (nested !== undefined) return nested
  }
  return null
}
