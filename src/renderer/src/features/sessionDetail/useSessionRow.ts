import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { groupSessionRows } from '@renderer/features/sessions/groupSessionRows'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { useSessions } from '@renderer/features/sessions/useSessions'
import { findSessionRow } from './findSessionRow'

/** What {@link useSessionRow} found. */
export interface SessionRowState {
  /** The session's row, or `null` while the list loads or when it doesn't hold the session. */
  readonly row: SessionRow | null
  /**
   * Whether the folder's list is still loading or reports the folder gone. A
   * session missing from the list can't be called not found yet: the folder's
   * own message covers the second case once the app has dropped the folder.
   */
  readonly listPending: boolean
}

/**
 * Finds the viewed session in its folder's sessions list, which holds its
 * title, usage and teammates. It reads only the folder it is given, never
 * another folder's list.
 *
 * @param ref - The viewed session.
 * @param dirName - The folder whose list to read: the selected project's.
 * @returns The session's row, and whether the list is still pending.
 */
export function useSessionRow(ref: SessionRefDto, dirName: string): SessionRowState {
  const { t } = useTranslation('sessions')
  const { data, error, isFetching } = useSessions(dirName)
  const row = useMemo(
    () => (data === undefined ? null : findSessionRow(groupSessionRows(data, t), ref)),
    [data, t, ref]
  )
  return { row, listPending: isFetching || IpcCallError.codeOf(error) === 'not-found' }
}
