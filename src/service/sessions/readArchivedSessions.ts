import type { ArchivedSession } from '../archive/archivePort'
import type { ServiceDeps } from '../serviceDeps'

/** Options for {@link readArchivedSessions}. */
export interface ReadArchivedSessionsOptions {
  /** Where to read from, or `null` to read nothing. */
  readonly archive: ServiceDeps['archive']
  /** The project folder whose archived sessions to read. */
  readonly projectDirName: string
  /** The ids of the folder's live sessions, which the archive must not shadow. */
  readonly liveSessionIds: ReadonlySet<string>
}

/**
 * Reads the archived sessions of a folder whose sessions are no longer on
 * disk, each with the team spawns stored beside it. The archive never throws,
 * so a failing read answers with no sessions and never fails the list.
 *
 * @param options - The archive, the folder, and its live session ids.
 * @returns The archived sessions, in the order the archive gives them.
 */
export function readArchivedSessions(
  options: ReadArchivedSessionsOptions
): readonly ArchivedSession[] {
  const { archive, projectDirName, liveSessionIds } = options
  if (archive === null) return []
  return archive.readSessions(projectDirName, liveSessionIds)
}
