import type { DatabaseSync } from 'node:sqlite'
import { err, ok, type Result } from '../../core/shared/result'
import { rollBack } from './rollBack'

/** The schema version this build reads and writes. */
export const ARCHIVE_SCHEMA_VERSION = 2

/** How long, in milliseconds, a statement waits on a lock held by another connection. */
const BUSY_TIMEOUT_MS = 100

const SCHEMA_VERSION_KEY = 'schema_version'

/** The columns version 2 added to `sessions`, which a version 1 file lacks. */
const SIDECAR_COLUMNS = ['team_spawns', 'lead_slots'] as const

const CREATE_META = 'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)'

/**
 * The large text columns come last, so reading the small ones never walks an
 * overflow chain. The sidecars, kept beside the list item for team grouping
 * and usage over time, are NULL until a list pass writes them. A file migrated
 * from version 1 has them after `detail`, since a column can only be appended.
 */
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
  team_spawns TEXT,
  lead_slots TEXT,
  list_item TEXT NOT NULL,
  detail TEXT,
  PRIMARY KEY (project_dir, session_id)
)`

/**
 * Prepares an archive database for use: sets a short busy timeout, checks the
 * schema version, then sets WAL mode with normal syncing (which WAL makes
 * safe). In one immediate transaction it then checks the version again, since
 * another build may have migrated in between, creates the tables, adds any
 * sidecar column the `sessions` table lacks (found by looking at the table, not
 * at the recorded version, so a file with no version row or one another
 * instance half migrated is covered), and records the version. A database whose
 * version is newer than this build's, or isn't a number, is left untouched,
 * and a version is never lowered.
 *
 * @param db - The open database.
 * @returns Success, or `newer-schema` when the database must not be used.
 * @throws {Error} When SQLite fails, for example on a corrupt file.
 */
export function applySchema(db: DatabaseSync): Result<void, 'newer-schema'> {
  db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`)
  db.exec(CREATE_META)
  if (!hasUsableVersion(db)) return err('newer-schema')
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('BEGIN IMMEDIATE')
  try {
    // Another build may have migrated since the first check, and the lock now keeps it from doing so again.
    if (!hasUsableVersion(db)) {
      rollBack(db)
      return err('newer-schema')
    }
    db.exec(CREATE_SESSIONS)
    addMissingSidecarColumns(db)
    db.prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
    ).run(SCHEMA_VERSION_KEY, String(ARCHIVE_SCHEMA_VERSION))
    db.exec('COMMIT')
  } catch (error) {
    rollBack(db)
    throw error
  }
  return ok(undefined)
}

/** Whether the recorded schema version, if there is one, is a number this build can use. */
function hasUsableVersion(db: DatabaseSync): boolean {
  const stored = db.prepare('SELECT value FROM meta WHERE key = ?').get(SCHEMA_VERSION_KEY)
  if (stored === undefined) return true
  const version = Number(stored['value'])
  return Number.isInteger(version) && version <= ARCHIVE_SCHEMA_VERSION
}

/** Adds each sidecar column the `sessions` table doesn't have yet. */
function addMissingSidecarColumns(db: DatabaseSync): void {
  const existing = new Set(
    db
      .prepare('PRAGMA table_info(sessions)')
      .all()
      .map((column) => String(column['name']))
  )
  for (const name of SIDECAR_COLUMNS) {
    if (!existing.has(name)) db.exec(`ALTER TABLE sessions ADD COLUMN ${name} TEXT`)
  }
}
