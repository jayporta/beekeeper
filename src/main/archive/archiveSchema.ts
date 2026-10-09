import type { DatabaseSync } from 'node:sqlite'
import { err, ok, type Result } from '../../core/shared/result'

/** The schema version this build reads and writes. */
export const ARCHIVE_SCHEMA_VERSION = 1

/** How long, in milliseconds, a statement waits on a lock held by another connection. */
const BUSY_TIMEOUT_MS = 100

const SCHEMA_VERSION_KEY = 'schema_version'

const CREATE_META = 'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'

/** The large text columns come last, so reading the small ones never walks an overflow chain. */
const CREATE_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  project_dir TEXT NOT NULL,
  session_id TEXT NOT NULL,
  source_mtime_ms REAL NOT NULL,
  source_size INTEGER NOT NULL,
  format INTEGER NOT NULL,
  activity_latest_ms REAL,
  detail_mtime_ms REAL,
  detail_size INTEGER,
  archived_at_ms REAL NOT NULL,
  list_item TEXT NOT NULL,
  detail TEXT,
  PRIMARY KEY (project_dir, session_id)
)`

/**
 * Prepares an archive database for use: sets WAL mode and a short busy
 * timeout, creates the tables, and records the schema version. A database
 * whose version is newer than this build's, or isn't a number, is left
 * untouched.
 *
 * @param db - The open database.
 * @returns Success, or `newer-schema` when the database must not be used.
 * @throws {Error} When SQLite fails, for example on a corrupt file.
 */
export function applySchema(db: DatabaseSync): Result<void, 'newer-schema'> {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec(CREATE_META)
  const stored = db.prepare('SELECT value FROM meta WHERE key = ?').get(SCHEMA_VERSION_KEY)
  if (stored !== undefined) {
    const version = Number(stored['value'])
    if (!Number.isInteger(version) || version > ARCHIVE_SCHEMA_VERSION) return err('newer-schema')
  }
  db.exec(CREATE_SESSIONS)
  db.prepare('INSERT OR IGNORE INTO meta (key, value) VALUES (?, ?)').run(
    SCHEMA_VERSION_KEY,
    String(ARCHIVE_SCHEMA_VERSION)
  )
  return ok(undefined)
}
