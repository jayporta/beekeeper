import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { sessionRefKey } from '../ipc/sessionRefKey'
import { ARCHIVE_FORMAT, MAX_ARCHIVED_DETAIL_CHARS } from './archiveConstants'
import type { ArchiveDb } from './openArchive'

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
   * Stores a session's list item, with its team cleared since a team is
   * recomputed from the family at list time. Does nothing, not even
   * serializing the item, when the stored row has the same source state and
   * format. A row stored in another format is rewritten and loses its detail.
   *
   * @param item - The list item to store.
   * @param source - The lead transcript's state the item was built from.
   */
  saveListItem(item: SessionListItemDto, source: SourceState): void
  /**
   * Stores a session's detail beside its archived list item. Does nothing
   * when the session has no archived list item at the current format, when
   * the stored detail has the same source state, or when the detail's JSON is
   * longer than the limit (that skip is logged once per source state).
   *
   * @param ref - The session the detail belongs to.
   * @param entry - The detail and the transcript state it was scanned from.
   */
  saveDetail(ref: SessionRefDto, entry: ArchivedDetailEntry): void
  /**
   * Whether the stored detail was scanned from this source state, at the
   * current format, or a detail for this state was skipped as too large.
   *
   * @param ref - The session to check.
   * @param source - The lead transcript's current state.
   * @returns `true` when archiving the detail again would change nothing.
   */
  hasDetail(ref: SessionRefDto, source: SourceState): boolean
  /** Closes the database. */
  close(): void
}

/** What the IPC handlers use of the store: the writes and the archiver's check, not `close`. */
export type ArchiveWriter = Pick<ArchiveStore, 'saveListItem' | 'saveDetail' | 'hasDetail'>

/** Options for {@link createArchiveStore}. */
export interface ArchiveStoreOptions {
  /** Reads the clock in epoch milliseconds. Defaults to `Date.now`. */
  readonly now?: () => number
  /** Receives each one-line log, which never carries a path. Defaults to `console.warn`. */
  readonly log?: (line: string) => void
}

/** The source state and format of a stored list item. */
interface StoredListState extends SourceState {
  readonly format: number
}

const SELECT_STATES = `
SELECT project_dir, session_id, source_mtime_ms, source_size, format,
       detail IS NOT NULL AS has_detail, detail_mtime_ms, detail_size
FROM sessions`

/** In an update, every right-hand side reads the old row, so `sessions.format` is the stored format. */
const UPSERT_LIST_ITEM = `
INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format, list_item, archived_at_ms)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (project_dir, session_id) DO UPDATE SET
  source_mtime_ms = excluded.source_mtime_ms,
  source_size = excluded.source_size,
  list_item = excluded.list_item,
  detail = CASE WHEN sessions.format = excluded.format THEN sessions.detail END,
  detail_mtime_ms = CASE WHEN sessions.format = excluded.format THEN sessions.detail_mtime_ms END,
  detail_size = CASE WHEN sessions.format = excluded.format THEN sessions.detail_size END,
  format = excluded.format,
  archived_at_ms = excluded.archived_at_ms
WHERE excluded.source_mtime_ms != sessions.source_mtime_ms
  OR excluded.source_size != sessions.source_size
  OR sessions.format != excluded.format`

const UPDATE_DETAIL = `
UPDATE sessions SET detail = ?, detail_mtime_ms = ?, detail_size = ?
WHERE project_dir = ? AND session_id = ?`

function sameSource(a: SourceState | undefined, b: SourceState): boolean {
  return a !== undefined && a.mtimeMs === b.mtimeMs && a.size === b.size
}

/**
 * Creates the archive store over an open database. It reads every row's key
 * and state once, then answers "is this session unchanged" from memory, so an
 * unchanged session costs neither serialization nor a write.
 *
 * @param db - The open archive database, whose schema is applied.
 * @param options - The clock and log, for tests.
 * @returns The store.
 */
export function createArchiveStore(db: ArchiveDb, options: ArchiveStoreOptions = {}): ArchiveStore {
  const { now = Date.now, log = console.warn } = options
  const upsertListItem = db.prepare(UPSERT_LIST_ITEM)
  const updateDetail = db.prepare(UPDATE_DETAIL)
  const listStates = new Map<string, StoredListState>()
  const detailStates = new Map<string, SourceState>()
  const oversizedStates = new Map<string, SourceState>()

  for (const row of db.prepare(SELECT_STATES).all()) {
    const key = sessionRefKey({
      projectDirName: String(row['project_dir']),
      sessionId: String(row['session_id'])
    })
    const format = Number(row['format'])
    listStates.set(key, {
      mtimeMs: Number(row['source_mtime_ms']),
      size: Number(row['source_size']),
      format
    })
    if (format === ARCHIVE_FORMAT && row['has_detail'] === 1) {
      detailStates.set(key, {
        mtimeMs: Number(row['detail_mtime_ms']),
        size: Number(row['detail_size'])
      })
    }
  }

  /** Whether archiving a detail for this source state would change nothing. */
  function isSettled(key: string, source: SourceState): boolean {
    return sameSource(detailStates.get(key), source) || sameSource(oversizedStates.get(key), source)
  }

  return {
    saveListItem(item, source) {
      const key = sessionRefKey(item)
      const stored = listStates.get(key)
      if (stored?.format === ARCHIVE_FORMAT && sameSource(stored, source)) return
      upsertListItem.run(
        item.projectDirName,
        item.sessionId,
        source.mtimeMs,
        source.size,
        ARCHIVE_FORMAT,
        JSON.stringify({ ...item, team: null }),
        now()
      )
      listStates.set(key, { ...source, format: ARCHIVE_FORMAT })
    },

    saveDetail(ref, { detail, source }) {
      const key = sessionRefKey(ref)
      if (listStates.get(key)?.format !== ARCHIVE_FORMAT) return
      if (isSettled(key, source)) return
      const json = JSON.stringify(detail)
      if (json.length > MAX_ARCHIVED_DETAIL_CHARS) {
        oversizedStates.set(key, source)
        log('Beekeeper archive skipped a session detail that is too large.')
        return
      }
      updateDetail.run(json, source.mtimeMs, source.size, ref.projectDirName, ref.sessionId)
      detailStates.set(key, source)
      oversizedStates.delete(key)
    },

    hasDetail(ref, source) {
      return isSettled(sessionRefKey(ref), source)
    },

    close() {
      db.close()
    }
  }
}
