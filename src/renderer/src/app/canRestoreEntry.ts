import type { QueryClient } from '@tanstack/react-query'
import type { ProjectDto } from '../../../shared/ipc/projectDto'
import { sameEntry, type NavEntry } from '@renderer/features/navigation/state/navigationHistory'
import { sessionDetailQueryOptions } from '@renderer/features/sessionDetail/sessionDetailQuery'
import { sessionsQueryOptions } from '@renderer/features/sessions/sessionsQuery'
import { IpcCallError } from '@renderer/ipc/ipcCallError'

/** What {@link canRestoreEntry} checks an entry against. */
interface RestoreContext {
  /** The listed projects, as they are now. */
  readonly projects: readonly ProjectDto[]
  /** The query client, whose cache says which sessions are known to be gone. */
  readonly client: QueryClient
  /** The place on screen. */
  readonly current: NavEntry
}

/**
 * Whether the app knows an entry's session no longer exists: its detail load
 * reported `not-found`, and the folder's cached list does not hold an archived
 * copy of it, which still has a summary page. With the list not cached the
 * copy may exist, so the session is not called gone.
 */
function isKnownGone(entry: NavEntry, client: QueryClient): boolean {
  const { sessionRef: ref, projectDirName } = entry
  if (ref === null) return false
  const detail = client.getQueryState(sessionDetailQueryOptions(ref).queryKey)
  if (detail?.status !== 'error' || IpcCallError.codeOf(detail.error) !== 'not-found') return false
  const list =
    projectDirName === null
      ? undefined
      : client.getQueryData(sessionsQueryOptions(projectDirName).queryKey)
  if (list === undefined) return false
  return !list.some(
    (item) =>
      item.archived &&
      item.projectDirName === ref.projectDirName &&
      item.sessionId === ref.sessionId
  )
}

/**
 * Whether Back can show an entry. It cannot when the entry's project is no
 * longer listed, when the entry is the place already on screen (the first
 * press would only move focus), or when its session is known to be gone. The
 * overview belongs to no project, so the list does not matter to it.
 *
 * @param entry - The history entry.
 * @param context - The project list, the query cache, and the place on screen.
 * @returns `true` when showing the entry would take the person somewhere.
 */
export function canRestoreEntry(entry: NavEntry, context: RestoreContext): boolean {
  const { projects, client, current } = context
  const { projectDirName } = entry
  if (projectDirName !== null && !projects.some((project) => project.dirName === projectDirName)) {
    return false
  }
  return !sameEntry(entry, current) && !isKnownGone(entry, client)
}
