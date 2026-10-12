import type { ArchivedSession } from '../archive/archivePort'
import type { TotalsSession } from './folderTotals'

/**
 * Takes an archived session as the folder totals take a live one, from its
 * list item. The item carries every figure the totals read.
 *
 * @param session - The archived session.
 * @returns The session's id, file time, subagent count and summary.
 */
export function archivedTotalsSession({ item }: ArchivedSession): TotalsSession {
  return {
    sessionId: item.sessionId,
    mtimeMs: item.modifiedMs,
    subagentCount: item.subagentCount,
    summary: item.summary.ok ? item.summary.value : null
  }
}
