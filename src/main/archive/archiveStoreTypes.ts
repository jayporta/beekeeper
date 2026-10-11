import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import type {
  ArchiveReader,
  ArchiveWriter,
  PendingDetail,
  SourceState
} from '../../service/archive/archivePort'

/**
 * The archive store. Unlike the services' archive port, its methods throw:
 * errors from SQLite propagate to the caller. Wrap it in `guardArchive`
 * before handing it to a service.
 */
export interface ArchiveStore extends ArchiveWriter, ArchiveReader {
  /**
   * Whether the stored list item was built from this source state, at the
   * current format, and has its team spawns and lead slots.
   *
   * @param ref - The session to check.
   * @param source - The lead transcript's current state.
   * @returns `true` when saving the list item again would change nothing.
   */
  hasListItem(ref: SessionRefDto, source: SourceState): boolean
  /**
   * Lists the sessions with an archived list item at the current format whose
   * detail isn't archived for the list item's source state, and wasn't
   * skipped as too large for it or by {@link ArchiveStore.skipDetail}.
   * Answered from memory.
   *
   * @returns The sessions a detail could still be archived for.
   */
  pendingDetails(): readonly PendingDetail[]
  /**
   * Takes a session out of {@link ArchiveStore.pendingDetails} for its list
   * item's current source state, as for a session whose transcript is gone.
   * Kept in memory only, so a later launch checks the session again. Does
   * nothing for a session with no archived list item.
   *
   * @param ref - The session to stop retrying.
   */
  skipDetail(ref: SessionRefDto): void
  /**
   * Closes the database. Every write after this is silently ignored, so a
   * write still in flight when the app quits fails nothing and logs nothing.
   * Closing again does nothing.
   */
  close(): void
}

/** Options for {@link createArchiveStore}. */
export interface ArchiveStoreOptions {
  /** Reads the clock in epoch milliseconds. Defaults to `Date.now`. */
  readonly now?: () => number
  /** Receives each one-line log, which never carries a path. Defaults to `console.warn`. */
  readonly log?: (line: string) => void
}
