import { compareCodeUnits } from '../../core/shared/compareCodeUnits'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { sessionRefKey } from '../ipc/sessionRefKey'
import { ARCHIVE_FORMAT } from './archiveConstants'
import { SELECT_DETAIL, SELECT_LIST_ITEM } from './archiveSql'
import type { ArchiveReader } from './archiveStoreTypes'
import type { ArchiveDb } from './openArchive'
import {
  parseArchivedDetail,
  parseArchivedListItem,
  type ArchivedRowError
} from './parseArchivedRow'

/** The archive's reads, and how the store tells them a row changed. */
export interface ArchiveReads extends ArchiveReader {
  /**
   * Registers a session's row, new or rewritten, and drops whatever was read
   * from it, so the next read goes to the database.
   *
   * @param ref - The session whose row was written.
   */
  rowChanged(ref: SessionRefDto): void
}

/** Options for {@link createArchiveReader}. */
export interface ArchiveReaderOptions {
  /** The open archive database. */
  readonly db: ArchiveDb
  /** Receives each one-line log, which never carries a path. */
  readonly log: (line: string) => void
  /** Whether the store has been closed, after which reads answer empty. */
  readonly isClosed: () => boolean
}

/** One folder's sessions: their ids, and the list item read for each one asked for so far. */
interface FolderRows {
  readonly ids: Set<string>
  /** The ids in code unit order, or `null` once an id was added. */
  sorted: string[] | null
  /** A row's list item once read, or `null` when the row can't be served. */
  readonly items: Map<string, SessionListItemDto | null>
}

/**
 * Creates the archive's reads. A row is read and parsed the first time a read
 * asks for it, and only then: a session the caller excludes is never touched.
 * What was read stays in memory until the row changes, so a list that is read
 * every few seconds costs a pass over the ids and no queries. The last detail
 * read is kept the same way.
 *
 * @param options - The database, where to log, and whether the store is closed.
 * @returns The reads, and `rowChanged` for the store to call after it writes.
 */
export function createArchiveReader(options: ArchiveReaderOptions): ArchiveReads {
  const { db, log, isClosed } = options
  const selectListItem = db.prepare(SELECT_LIST_ITEM)
  const selectDetail = db.prepare(SELECT_DETAIL)
  const folders = new Map<string, FolderRows>()
  const loggedRowErrors = new Set<ArchivedRowError>()
  let lastDetail: { readonly key: string; readonly detail: SessionDetailDto } | null = null

  /** Logs a kind of unreadable row the first time it is seen. */
  function logUnreadableRow(error: ArchivedRowError): void {
    if (loggedRowErrors.has(error)) return
    loggedRowErrors.add(error)
    log(`Beekeeper archive skipped an unreadable row (${error}).`)
  }

  /** Reads and parses one list item row, remembering the outcome. */
  function readItem(folder: FolderRows, ref: SessionRefDto): SessionListItemDto | null {
    const cached = folder.items.get(ref.sessionId)
    if (cached !== undefined) return cached
    const row = selectListItem.get(ref.projectDirName, ref.sessionId, ARCHIVE_FORMAT)
    let item: SessionListItemDto | null = null
    if (row !== undefined) {
      const parsed = parseArchivedListItem(String(row['list_item']), ref)
      if (parsed.ok) item = parsed.value
      else logUnreadableRow(parsed.error)
    }
    folder.items.set(ref.sessionId, item)
    return item
  }

  return {
    rowChanged(ref) {
      let folder = folders.get(ref.projectDirName)
      if (folder === undefined) {
        folder = { ids: new Set(), sorted: null, items: new Map() }
        folders.set(ref.projectDirName, folder)
      }
      if (!folder.ids.has(ref.sessionId)) {
        folder.ids.add(ref.sessionId)
        folder.sorted = null
      }
      folder.items.delete(ref.sessionId)
      if (lastDetail?.key === sessionRefKey(ref)) lastDetail = null
    },

    readListItems(projectDirName, excluding) {
      const folder = folders.get(projectDirName)
      if (isClosed() || folder === undefined) return []
      folder.sorted ??= [...folder.ids].sort(compareCodeUnits)
      const items: SessionListItemDto[] = []
      for (const sessionId of folder.sorted) {
        if (excluding.has(sessionId)) continue
        const item = readItem(folder, { projectDirName, sessionId })
        if (item !== null) items.push(item)
      }
      return items
    },

    readDetail(ref) {
      if (isClosed()) return null
      const key = sessionRefKey(ref)
      if (lastDetail?.key === key) return lastDetail.detail
      const json = selectDetail.get(ref.projectDirName, ref.sessionId, ARCHIVE_FORMAT)?.['detail']
      if (typeof json !== 'string') return null
      const parsed = parseArchivedDetail(json, ref)
      if (!parsed.ok) {
        logUnreadableRow(parsed.error)
        return null
      }
      lastDetail = { key, detail: parsed.value }
      return parsed.value
    }
  }
}
