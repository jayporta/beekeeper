import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { groupSessionRows } from '@renderer/features/sessions/groupSessionRows'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { useSessions } from '@renderer/features/sessions/useSessions'
import { findRootRow } from './findRootRow'

/**
 * Finds the viewed session in its folder's sessions list, which holds its
 * title, usage and teammates. It reads only the folder it is given, never
 * another folder's list.
 *
 * @param ref - The viewed session.
 * @param dirName - The folder whose list to read: the selected project's.
 * @returns The session's row, or `null` while the list loads or when it doesn't hold the session.
 */
export function useSessionRow(ref: SessionRefDto, dirName: string): SessionRow | null {
  const { t } = useTranslation('sessions')
  const { data } = useSessions(dirName)
  return useMemo(
    () => (data === undefined ? null : findRootRow(groupSessionRows(data, t), ref)),
    [data, t, ref]
  )
}
