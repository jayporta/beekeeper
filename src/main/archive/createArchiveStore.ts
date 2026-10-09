import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { compareCodeUnits } from '../../core/shared/compareCodeUnits'
import { sessionRefKey } from '../ipc/sessionRefKey'
import { ARCHIVE_FORMAT, MAX_ARCHIVED_DETAIL_CHARS } from './archiveConstants'
import type {
  ArchiveStore,
  ArchiveStoreOptions,
  ListItemEntry,
  PendingDetail,
  SourceState
} from './archiveStoreTypes'
import {
  SELECT_DETAIL,
  SELECT_LIST_ITEM,
  SELECT_STATES,
  UPDATE_DETAIL,
  UPSERT_LIST_ITEM
} from './archiveSql'
import type { ArchiveDb } from './openArchive'
import {
  parseArchivedDetail,
  parseArchivedListItem,
  type ArchivedRowError
} from './parseArchivedRow'

/** A stored list item's session, source state, format, and last message time. */
interface StoredListEntry {
  readonly ref: SessionRefDto
  readonly source: SourceState
  readonly format: number
  readonly activityLatestMs: number | null
}

function activityLatestOf(item: SessionListItemDto): number | null {
  return item.summary.ok ? (item.summary.value.activity?.latestMs ?? null) : null
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
  const selectListItem = db.prepare(SELECT_LIST_ITEM)
  const selectDetail = db.prepare(SELECT_DETAIL)
  const loggedRowErrors = new Set<ArchivedRowError>()
  let closed = false
  const listEntries = new Map<string, StoredListEntry>()
  /**
   * The source state each session's detail is settled for: stored, or skipped
   * as too large (the row keeps the state with no detail), or given up on by
   * {@link ArchiveStore.skipDetail} (memory only).
   */
  const settledStates = new Map<string, SourceState>()

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
      settledStates.set(key, {
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
    return sameSource(settledStates.get(key), source)
  }

  /** Logs a kind of unreadable row the first time it is seen. */
  function logUnreadableRow(error: ArchivedRowError): void {
    if (loggedRowErrors.has(error)) return
    loggedRowErrors.add(error)
    log(`Beekeeper archive skipped an unreadable row (${error}).`)
  }

  /** Upserts the entries whose stored row is out of date, in one transaction. */
  function saveListItems(entries: readonly ListItemEntry[]): void {
    if (closed) return
    const writes = entries.filter(
      ({ item, source }) => !isListItemCurrent(sessionRefKey(item), source)
    )
    if (writes.length === 0) return
    db.exec('BEGIN')
    try {
      for (const { item, source } of writes) {
        upsertListItem.run(
          item.projectDirName,
          item.sessionId,
          source.mtimeMs,
          source.size,
          ARCHIVE_FORMAT,
          activityLatestOf(item),
          JSON.stringify({ ...item, team: null }),
          now()
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK')
      throw error
    }
    for (const { item, source } of writes) {
      const key = sessionRefKey(item)
      settledStates.delete(key)
      listEntries.set(key, {
        ref: { projectDirName: item.projectDirName, sessionId: item.sessionId },
        source,
        format: ARCHIVE_FORMAT,
        activityLatestMs: activityLatestOf(item)
      })
    }
  }

  return {
    saveListItems,

    saveDetail(ref, { detail, source }) {
      if (closed) return
      const key = sessionRefKey(ref)
      if (listEntries.get(key)?.format !== ARCHIVE_FORMAT) return
      if (isSettled(key, source)) return
      const json = JSON.stringify(detail)
      const oversized = json.length > MAX_ARCHIVED_DETAIL_CHARS
      updateDetail.run(
        oversized ? null : json,
        source.mtimeMs,
        source.size,
        ref.projectDirName,
        ref.sessionId
      )
      settledStates.set(key, source)
      if (oversized) log('Beekeeper archive skipped a session detail that is too large.')
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

    readListItems(projectDirName, excluding) {
      if (closed) return []
      const refs = [...listEntries.values()]
        .filter(({ ref }) => ref.projectDirName === projectDirName && !excluding.has(ref.sessionId))
        .map(({ ref }) => ref)
        .sort((a, b) => compareCodeUnits(a.sessionId, b.sessionId))
      const items: SessionListItemDto[] = []
      for (const ref of refs) {
        const row = selectListItem.get(ref.projectDirName, ref.sessionId, ARCHIVE_FORMAT)
        if (row === undefined) continue
        const parsed = parseArchivedListItem(String(row['list_item']), ref)
        if (parsed.ok) items.push(parsed.value)
        else logUnreadableRow(parsed.error)
      }
      return items
    },

    readDetail(ref) {
      if (closed) return null
      const row = selectDetail.get(ref.projectDirName, ref.sessionId, ARCHIVE_FORMAT)
      const json = row?.['detail']
      if (typeof json !== 'string') return null
      const parsed = parseArchivedDetail(json, ref)
      if (parsed.ok) return parsed.value
      logUnreadableRow(parsed.error)
      return null
    },

    skipDetail(ref) {
      if (closed) return
      const key = sessionRefKey(ref)
      const entry = listEntries.get(key)
      if (entry !== undefined) settledStates.set(key, entry.source)
    },

    close() {
      if (closed) return
      closed = true
      db.close()
    }
  }
}
