import { compareCodeUnits } from '../../core/shared/compareCodeUnits'
import type { TranscriptTeamSpawns } from '../../core/transcript/teammateSpawn'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { sessionRefKey } from '../ipc/sessionRefKey'
import { ARCHIVE_FORMAT } from './archiveConstants'
import { SELECT_DETAIL, SELECT_SESSION_ROW } from './archiveSql'
import type { ArchivedSession, ArchiveReader } from './archiveStoreTypes'
import type { ArchiveDb } from './openArchive'
import {
  parseArchivedDetail,
  parseArchivedListItem,
  parseArchivedTeamSpawns,
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
  /** A row's session once read, or `null` when the row can't be served. */
  readonly sessions: Map<string, ArchivedSession | null>
}

/**
 * Creates the archive's reads. A row is read and parsed, sidecars included,
 * the first time a read asks for it, and only then: a session the caller
 * excludes is never touched. What was read stays in memory until the row
 * changes, so a list that is read every few seconds costs a pass over the ids
 * and no queries or parsing. The last detail read is kept the same way.
 *
 * @param options - The database, where to log, and whether the store is closed.
 * @returns The reads, and `rowChanged` for the store to call after it writes.
 */
export function createArchiveReader(options: ArchiveReaderOptions): ArchiveReads {
  const { db, log, isClosed } = options
  const selectSessionRow = db.prepare(SELECT_SESSION_ROW)
  const selectDetail = db.prepare(SELECT_DETAIL)
  const folders = new Map<string, FolderRows>()
  const loggedRowErrors = new Set<ArchivedRowError>()
  const loggedSpawnsErrors = new Set<ArchivedRowError>()
  let lastDetail: { readonly key: string; readonly detail: SessionDetailDto } | null = null

  /** Logs a kind of unreadable row the first time it is seen. */
  function logUnreadableRow(error: ArchivedRowError): void {
    if (loggedRowErrors.has(error)) return
    loggedRowErrors.add(error)
    log(`Beekeeper archive skipped an unreadable row (${error}).`)
  }

  /** Parses the team spawns column, which is `null` when the row has none stored or they can't be read. */
  function readTeamSpawns(stored: unknown): TranscriptTeamSpawns | null {
    if (typeof stored !== 'string') return null
    const parsed = parseArchivedTeamSpawns(stored)
    if (parsed.ok) return parsed.value
    if (!loggedSpawnsErrors.has(parsed.error)) {
      loggedSpawnsErrors.add(parsed.error)
      log(`Beekeeper archive skipped unreadable team spawns (${parsed.error}).`)
    }
    return null
  }

  /** Reads and parses one row and its team spawns, remembering the outcome. */
  function readSession(folder: FolderRows, ref: SessionRefDto): ArchivedSession | null {
    const cached = folder.sessions.get(ref.sessionId)
    if (cached !== undefined) return cached
    const row = selectSessionRow.get(ref.projectDirName, ref.sessionId, ARCHIVE_FORMAT)
    let session: ArchivedSession | null = null
    if (row !== undefined) {
      const parsed = parseArchivedListItem(String(row['list_item']), ref)
      if (parsed.ok) {
        session = {
          item: parsed.value,
          teamSpawns: readTeamSpawns(row['team_spawns'])
        }
      } else logUnreadableRow(parsed.error)
    }
    folder.sessions.set(ref.sessionId, session)
    return session
  }

  /** The folder's readable sessions in session id order, leaving out the excluded ones. */
  function readSessions(
    projectDirName: string,
    excluding: ReadonlySet<string>
  ): readonly ArchivedSession[] {
    const folder = folders.get(projectDirName)
    if (isClosed() || folder === undefined) return []
    folder.sorted ??= [...folder.ids].sort(compareCodeUnits)
    const sessions: ArchivedSession[] = []
    for (const sessionId of folder.sorted) {
      if (excluding.has(sessionId)) continue
      const session = readSession(folder, { projectDirName, sessionId })
      if (session !== null) sessions.push(session)
    }
    return sessions
  }

  return {
    rowChanged(ref) {
      let folder = folders.get(ref.projectDirName)
      if (folder === undefined) {
        folder = { ids: new Set(), sorted: null, sessions: new Map() }
        folders.set(ref.projectDirName, folder)
      }
      if (!folder.ids.has(ref.sessionId)) {
        folder.ids.add(ref.sessionId)
        folder.sorted = null
      }
      folder.sessions.delete(ref.sessionId)
      if (lastDetail?.key === sessionRefKey(ref)) lastDetail = null
    },

    readSessions,

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
