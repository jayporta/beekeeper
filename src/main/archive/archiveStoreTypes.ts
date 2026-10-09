import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'

/** The state of a session's lead transcript that an archived copy was made from. */
export interface SourceState {
  /** The transcript's last-modified time in epoch milliseconds. */
  readonly mtimeMs: number
  /** The transcript's size in bytes. */
  readonly size: number
}

/** A session detail and the transcript state it was scanned from. */
export interface ArchivedDetailEntry {
  /** The detail to store. */
  readonly detail: SessionDetailDto
  /** The lead transcript's state when the detail was scanned. */
  readonly source: SourceState
}

/** Writes to the archive. Errors from SQLite propagate to the caller. */
export interface ArchiveStore {
  /**
   * Stores list items in one transaction, with each item's team cleared since
   * a team is recomputed from the family at list time. An entry whose stored
   * row has the same source state and format is skipped without being
   * serialized, and a batch of only such entries opens no transaction. A row
   * stored in another format is rewritten and loses its detail. When a write
   * fails, the whole batch is rolled back and the error is thrown, and the
   * store behaves as if none of it had been saved.
   *
   * @param entries - The list items and the source states they were built from.
   */
  saveListItems(entries: readonly ListItemEntry[]): void
  /**
   * Stores a session's detail beside its archived list item. Does nothing
   * when the session has no archived list item at the current format, when
   * the stored detail has the same source state, or when the detail's JSON is
   * longer than the limit. In that last case the row records the source state
   * as skipped, with no detail (replacing any older one), and it is logged
   * once per source state.
   *
   * @param ref - The session the detail belongs to.
   * @param entry - The detail and the transcript state it was scanned from.
   */
  saveDetail(ref: SessionRefDto, entry: ArchivedDetailEntry): void
  /**
   * Whether the stored list item was built from this source state, at the
   * current format.
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
   * Reads the archived list items of a project folder, leaving out the
   * sessions named in `excluding` without reading their rows. A row at
   * another format, or one that fails to parse or doesn't carry its own keys,
   * is left out, and each kind of unreadable row is logged once. Rows are read
   * one at a time, so the cost follows the sessions returned.
   *
   * @param projectDirName - The project folder.
   * @param excluding - Session ids to leave out, such as the folder's live sessions.
   * @returns The items in session id order, or an empty list after the store is closed.
   */
  readListItems(
    projectDirName: string,
    excluding: ReadonlySet<string>
  ): readonly SessionListItemDto[]
  /**
   * Reads a session's archived detail.
   *
   * @param ref - The session.
   * @returns The detail, or `null` when the session has none at the current
   * format (including one skipped as too large), the row can't be read, or the
   * store is closed.
   */
  readDetail(ref: SessionRefDto): SessionDetailDto | null
  /**
   * Closes the database. Every write after this is silently ignored, so a
   * write still in flight when the app quits fails nothing and logs nothing.
   * Closing again does nothing.
   */
  close(): void
}

/** A session whose archived list item has no detail archived for its source state. */
export interface PendingDetail {
  /** The session. */
  readonly ref: SessionRefDto
  /** The lead transcript's state the list item was built from. */
  readonly source: SourceState
  /** The session's latest message time in epoch milliseconds, or `null` when it has none. */
  readonly activityLatestMs: number | null
}

/** One list item to store, with the source state it was built from. */
export interface ListItemEntry {
  /** The list item. */
  readonly item: SessionListItemDto
  /** The lead transcript's state the item was built from. */
  readonly source: SourceState
}

/** What the IPC handlers use of the store to write. */
export type ArchiveWriter = Pick<ArchiveStore, 'saveListItems' | 'saveDetail'>

/** What the IPC handlers use of the store to read. */
export type ArchiveReader = Pick<ArchiveStore, 'readListItems' | 'readDetail'>

/** Options for {@link createArchiveStore}. */
export interface ArchiveStoreOptions {
  /** Reads the clock in epoch milliseconds. Defaults to `Date.now`. */
  readonly now?: () => number
  /** Receives each one-line log, which never carries a path. Defaults to `console.warn`. */
  readonly log?: (line: string) => void
}
