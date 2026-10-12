import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { groupSessionRows } from '../../../../shared/sessions/groupSessionRows'
import { sessionKey } from '../../../../shared/sessions/sessionKey'
import type { SessionRow } from '../../../../shared/sessions/sessionRow'
import { testSession } from '../../../../shared/sessions/testSessionFixtures'
import { testLabelWords } from './testLabelWords'

/**
 * The top-level row for the `n`th test session, grouped with the other
 * sessions as the list would be.
 *
 * @param n - The session number, as passed to `testSession`.
 * @param items - Every session in the list.
 * @returns The row, with its teammates.
 * @throws {Error} When the session is not a top-level row of the list.
 */
export function testRow(n: number, items: readonly SessionListItemDto[]): SessionRow {
  const target = items.find((item) => item.sessionId === testSession(n).sessionId)
  const row = groupSessionRows(items, testLabelWords).find(
    (candidate) => target !== undefined && candidate.key === sessionKey(target)
  )
  if (row === undefined) throw new Error(`no top-level row for test session ${n}`)
  return row
}
