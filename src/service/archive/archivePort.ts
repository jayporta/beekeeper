import type { LeadSlots } from '../../core/transcript/summary/leadUsage'
import type { TranscriptTeamSpawns } from '../../core/transcript/teammateSpawn'
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

/** A session's own assistant usage per 15-minute slot, as the archive stores it for usage over time. */
export type ArchivedLeadSlots = LeadSlots

/** A session detail and the transcript state it was scanned from. */
export interface ArchivedDetailEntry {
  /** The detail to store. */
  readonly detail: SessionDetailDto
  /** The lead transcript's state when the detail was scanned. */
  readonly source: SourceState
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
  /** The teammates the transcript spawned and stopped, which team grouping reads. */
  readonly teamSpawns: TranscriptTeamSpawns
  /** The transcript's own usage per slot, or `null` when its scan held more messages than it keeps. */
  readonly leadSlots: ArchivedLeadSlots | null
}

/** An archived session: its list item, and the team spawns stored beside it for grouping. */
export interface ArchivedSession {
  /** The archived list item. */
  readonly item: SessionListItemDto
  /** The teammates the transcript spawned and stopped, or `null` when the row has none stored or they can't be read. */
  readonly teamSpawns: TranscriptTeamSpawns | null
}

/**
 * What the services write to the archive. A method never throws: a host
 * guards its store, so a failed write is a skipped one and never fails the
 * request that triggered it.
 */
export interface ArchiveWriter {
  /**
   * Stores list items in one transaction, with each item's team cleared since
   * a team is recomputed from the family at list time. An entry whose stored
   * row has the same source state and format is skipped without being
   * serialized, and a batch of only such entries opens no transaction. A row
   * whose source state changed is rewritten, and keeps its detail only when
   * that detail was scanned from the new state. A row stored in another format
   * is rewritten and loses its detail. When a write fails, the whole batch is
   * rolled back, and the store behaves as if none of it had been saved. The
   * raw SQLite store then throws; the guarded archive the services receive
   * logs the failure and skips the write.
   *
   * A row stored without its team spawns and lead slots (one written before
   * they were kept) counts as out of date, so it is rewritten once with them,
   * keeping a detail scanned from the same source state.
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
}

/**
 * What the services read from the archive. A method never throws: a host
 * guards its store, so a failed read answers as the archive having nothing.
 */
export interface ArchiveReader {
  /**
   * Reads the archived sessions of a project folder, leaving out the sessions
   * named in `excluding` without reading their rows. A row at another format,
   * or one that fails to parse or doesn't carry its own keys, is left out, and
   * each kind of unreadable row is logged once. Team spawns that are missing or
   * fail to parse read as `null` and never drop the session; a failure is
   * logged once per kind. Rows are read one at a time, and kept in
   * memory until a save changes them, so the cost follows the sessions returned.
   *
   * @param projectDirName - The project folder.
   * @param excluding - Session ids to leave out, such as the folder's live sessions.
   * @returns The sessions in session id order, or an empty list after the store is closed.
   */
  readSessions(projectDirName: string, excluding: ReadonlySet<string>): readonly ArchivedSession[]
  /**
   * Reads a session's own usage per slot, which {@link ArchiveReader.readSessions}
   * leaves out because only the overview asks for it. The first read of a row
   * queries and parses it, and what was read stays in memory until a save
   * changes the row.
   *
   * @param ref - The session.
   * @returns The slots (empty for a transcript with no usage), or `null` when
   * the session has none at the current format (none stored, or its scan held
   * more messages than it keeps), the column can't be read (logged once per
   * kind), or the store is closed.
   */
  readLeadSlots(ref: SessionRefDto): ArchivedLeadSlots | null
  /**
   * Reads a session's archived detail.
   *
   * @param ref - The session.
   * @returns The detail, or `null` when the session has none at the current
   * format (including one skipped as too large), the row can't be read, or the
   * store is closed.
   */
  readDetail(ref: SessionRefDto): SessionDetailDto | null
}
