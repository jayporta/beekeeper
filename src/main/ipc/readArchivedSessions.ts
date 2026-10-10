import type { ArchivedSession } from '../archive/archiveStoreTypes'
import { guardArchiveCall } from '../archive/guardArchiveCall'
import type { IpcDeps } from './ipcDeps'

/** Options for {@link readArchivedSessions}. */
export interface ReadArchivedSessionsOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: IpcDeps['archive']
  /** The project folder whose archived sessions to read. */
  readonly projectDirName: string
  /** The ids of the folder's live sessions, which the archive must not shadow. */
  readonly liveSessionIds: ReadonlySet<string>
}

/**
 * Reads the archived sessions of a folder whose sessions are no longer on
 * disk, each with the team spawns stored beside it. A failing read is logged
 * once per kind and answers with no sessions, so it never fails the list.
 *
 * @param options - The archive, the folder, and its live session ids.
 * @returns The archived sessions, in the order the archive gives them.
 */
export function readArchivedSessions(
  options: ReadArchivedSessionsOptions
): readonly ArchivedSession[] {
  const { archive, projectDirName, liveSessionIds } = options
  if (archive === null) return []
  return guardArchiveCall({
    run: () => archive.readSessions(projectDirName, liveSessionIds),
    fallback: [],
    kind: 'read'
  })
}
