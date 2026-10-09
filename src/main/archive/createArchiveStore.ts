import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { sessionRefKey } from '../ipc/sessionRefKey'
import { ARCHIVE_FORMAT, MAX_ARCHIVED_DETAIL_CHARS } from './archiveConstants'
import { SELECT_STATES, UPDATE_DETAIL, UPSERT_LIST_ITEM } from './archiveSql'
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
   * skipped as too large for it. Answered from memory.
   *
   * @returns The sessions a detail could still be archived for.
   */
  pendingDetails(): readonly PendingDetail[]
  /** Closes the database. */
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

/** What the IPC handlers use of the store: the writes and the archiver's check, not `close`. */
export type ArchiveWriter = Pick<ArchiveStore, 'saveListItem' | 'saveDetail' | 'hasDetail'>

/** Options for {@link createArchiveStore}. */
export interface ArchiveStoreOptions {
  /** Reads the clock in epoch milliseconds. Defaults to `Date.now`. */
  readonly now?: () => number
  /** Receives each one-line log, which never carries a path. Defaults to `console.warn`. */
  readonly log?: (line: string) => void
}

/** A stored list item's session, source state, format, and last message time. */
interface StoredListEntry {
  readonly ref: SessionRefDto
  readonly source: SourceState
  readonly format: number
  readonly activityLatestMs: number | null
}

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
  const listEntries = new Map<string, StoredListEntry>()
  const detailStates = new Map<string, SourceState>()
  const oversizedStates = new Map<string, SourceState>()

  for (const row of db.prepare(SELECT_STATES).all()) {
    const ref = {
      projectDirName: String(row['project_dir']),
      sessionId: String(row['session_id'])
    }
    const key = sessionRefKey(ref)
    const format = Number(row['format'])
    const activity = row['activity_latest_ms']
    listEntries.set(key, {
      ref,
      source: { mtimeMs: Number(row['source_mtime_ms']), size: Number(row['source_size']) },
      format,
      activityLatestMs: activity === null ? null : Number(activity)
    })
    if (format === ARCHIVE_FORMAT && row['detail_mtime_ms'] !== null) {
      detailStates.set(key, {
        mtimeMs: Number(row['detail_mtime_ms']),
        size: Number(row['detail_size'])
      })
    }
  }

  /** Whether the stored list item for a key was built from this source state at the current format. */
  function isListItemCurrent(key: string, source: SourceState): boolean {
    const entry = listEntries.get(key)
    return entry?.format === ARCHIVE_FORMAT && sameSource(entry.source, source)
  }

  /** Whether archiving a detail for this source state would change nothing. */
  function isSettled(key: string, source: SourceState): boolean {
    return sameSource(detailStates.get(key), source) || sameSource(oversizedStates.get(key), source)
  }

  return {
    saveListItem(item, source) {
      const key = sessionRefKey(item)
      if (isListItemCurrent(key, source)) return
      const activityLatestMs = item.summary.ok
        ? (item.summary.value.activity?.latestMs ?? null)
        : null
      upsertListItem.run(
        item.projectDirName,
        item.sessionId,
        source.mtimeMs,
        source.size,
        ARCHIVE_FORMAT,
        activityLatestMs,
        JSON.stringify({ ...item, team: null }),
        now()
      )
      listEntries.set(key, {
        ref: { projectDirName: item.projectDirName, sessionId: item.sessionId },
        source,
        format: ARCHIVE_FORMAT,
        activityLatestMs
      })
    },

    saveDetail(ref, { detail, source }) {
      const key = sessionRefKey(ref)
      if (listEntries.get(key)?.format !== ARCHIVE_FORMAT) return
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

    hasListItem(ref, source) {
      return isListItemCurrent(sessionRefKey(ref), source)
    },

    pendingDetails() {
      const pending: PendingDetail[] = []
      for (const [key, entry] of listEntries) {
        if (entry.format !== ARCHIVE_FORMAT || isSettled(key, entry.source)) continue
        pending.push({
          ref: entry.ref,
          source: entry.source,
          activityLatestMs: entry.activityLatestMs
        })
      }
      return pending
    },

    close() {
      db.close()
    }
  }
}
