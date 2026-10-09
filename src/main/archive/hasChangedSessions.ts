import { discoverSessions } from '../../core/transcript/discoverSessions'
import type { ArchiveStore } from './createArchiveStore'

/** Options for {@link hasChangedSessions}. */
export interface HasChangedSessionsOptions {
  /** The project folder's name. */
  readonly projectDirName: string
  /** The project folder's absolute path. */
  readonly projectPath: string
  /** The archive, asked whether each session's list item is current. */
  readonly store: Pick<ArchiveStore, 'hasListItem'>
  /** Lists a project folder's sessions. Defaults to {@link discoverSessions}, and is injectable for tests. */
  readonly discover?: typeof discoverSessions
}

/**
 * Finds out whether a project holds a session the archive doesn't have at its
 * current transcript state, from a stat of each transcript alone, so no
 * transcript is read.
 *
 * @param options - The project and the archive.
 * @returns `true` when some session is new or its transcript's modification
 * time or size differs from the archived list item. A session whose
 * transcript can't be stat'd is ignored, since it can't be archived.
 */
export async function hasChangedSessions(options: HasChangedSessionsOptions): Promise<boolean> {
  const { projectDirName, projectPath, store, discover = discoverSessions } = options
  const sessions = await discover(projectPath)
  return sessions.some(({ sessionId, transcript }) => {
    if (!transcript.ok) return false
    const { mtimeMs, size } = transcript.value
    return !store.hasListItem({ projectDirName, sessionId }, { mtimeMs, size })
  })
}
