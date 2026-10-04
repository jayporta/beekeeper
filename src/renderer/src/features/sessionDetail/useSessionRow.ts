import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionRefDto } from '../../../../shared/ipc/sessionRefDto'
import { IpcCallError } from '@renderer/ipc/ipcCallError'
import { useProjects } from '@renderer/features/projects/useProjects'
import { groupSessionRows } from '@renderer/features/sessions/groupSessionRows'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import { useSessions } from '@renderer/features/sessions/useSessions'
import { findSessionRow } from './findSessionRow'

/** What {@link useSessionRow} found. */
export interface SessionRowState {
  /** The session's row, or `null` while the list loads or when it doesn't hold the session. */
  readonly row: SessionRow | null
  /**
   * Whether the folder's list hasn't given its answer yet: its first load since
   * mount is in flight, or it reports the folder gone and the project list
   * hasn't settled since. Reporting the folder gone makes the app refetch the
   * project list, so that refetch is the one awaited, from the very render the
   * report arrives in. A session missing from the list can't be called not found
   * yet. Later background refetches don't count, and neither does a gone folder
   * once the project list has settled, since then the folder is still in effect
   * and this view is the one to say so.
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
  const { data, error, errorUpdatedAt, isFetching, isFetchedAfterMount } = useSessions(dirName)
  const projects = useProjects()
  const row = useMemo(
    () => (data === undefined ? null : findSessionRow(groupSessionRows(data, t), ref)),
    [data, t, ref]
  )
  const firstLoad = isFetching && !isFetchedAfterMount
  const folderGone = IpcCallError.codeOf(error) === 'not-found'
  const projectsSettledAt = Math.max(projects.dataUpdatedAt, projects.errorUpdatedAt)
  return { row, listPending: firstLoad || (folderGone && projectsSettledAt < errorUpdatedAt) }
}
