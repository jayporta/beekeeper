import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import { safeArchiveRead } from '../archive/safeArchiveRead'
import type { IpcDeps } from './ipcDeps'

/** Options for {@link readArchivedListItems}. */
export interface ReadArchivedListItemsOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: IpcDeps['archive']
  /** The project folder the list was requested for. */
  readonly projectDirName: string
  /** The ids of the folder's live sessions, which the archive must not shadow. */
  readonly liveSessionIds: ReadonlySet<string>
}

/**
 * Reads the archived list items of a folder whose sessions are no longer on
 * disk, marked archived and without a team, since archived sessions take no
 * part in team grouping. A failing read is logged once per kind and answers
 * with no items, so it never fails the list.
 *
 * @param options - The archive, the requested folder, and its live session ids.
 * @returns The archived items, in the order the archive gives them.
 */
export function readArchivedListItems(
  options: ReadArchivedListItemsOptions
): readonly SessionListItemDto[] {
  const { archive, projectDirName, liveSessionIds } = options
  if (archive === null) return []
  return safeArchiveRead(() => archive.readListItems(projectDirName, liveSessionIds), []).map(
    (item): SessionListItemDto => ({ ...item, archived: true, team: null })
  )
}
