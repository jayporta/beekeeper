import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applySchema, ARCHIVE_SCHEMA_VERSION } from '../archiveSchema'

function tableNames(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
  return rows.map((row) => String(row['name']))
}

function storedVersion(db: DatabaseSync): string | undefined {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
  return row === undefined ? undefined : String(row['value'])
}

describe('applySchema', () => {
  it('creates the tables and records the schema version in a fresh database', () => {
    const db = new DatabaseSync(':memory:')

    const result = applySchema(db)

    expect(result).toEqual({ ok: true, value: undefined })
    expect(tableNames(db)).toEqual(['meta', 'sessions'])
    expect(storedVersion(db)).toBe(String(ARCHIVE_SCHEMA_VERSION))
  })

  it('leaves existing rows alone when applied to a current database again', () => {
    const db = new DatabaseSync(':memory:')
    applySchema(db)
    db.prepare("INSERT INTO meta (key, value) VALUES ('probe', 'kept')").run()

    const result = applySchema(db)

    expect(result.ok).toBe(true)
    expect(db.prepare("SELECT value FROM meta WHERE key = 'probe'").get()?.['value']).toBe('kept')
  })

  it('refuses a database written by a newer schema and does not create the sessions table', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '3')")

    const result = applySchema(db)

    expect(result).toEqual({ ok: false, error: 'newer-schema' })
    expect(tableNames(db)).toEqual(['meta'])
    expect(storedVersion(db)).toBe('3')
  })

  it('refuses a database whose schema version is not a number', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    db.exec("INSERT INTO meta (key, value) VALUES ('schema_version', 'banana')")

    const result = applySchema(db)

    expect(result).toEqual({ ok: false, error: 'newer-schema' })
  })

  it('keeps the large text columns last so reading the small ones never walks an overflow chain', () => {
    const db = new DatabaseSync(':memory:')

    applySchema(db)

    const columns = db
      .prepare('PRAGMA table_info(sessions)')
      .all()
      .map((c) => String(c['name']))
    expect(columns.slice(-2)).toEqual(['list_item', 'detail'])
  })

  it('syncs at the normal level, which is safe in WAL mode', () => {
    const db = new DatabaseSync(':memory:')

    applySchema(db)

    expect(db.prepare('PRAGMA synchronous').get()?.['synchronous']).toBe(1)
  })

  it('waits only a short time on a locked database', () => {
    const db = new DatabaseSync(':memory:')

    applySchema(db)

    expect(db.prepare('PRAGMA busy_timeout').get()?.['timeout']).toBe(100)
  })
})

/** The `sessions` table as version 1 created it, with no sidecar columns. */
const VERSION_1_SESSIONS = `
CREATE TABLE sessions (
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

function columnNames(db: DatabaseSync): string[] {
  return db
    .prepare('PRAGMA table_info(sessions)')
    .all()
    .map((c) => String(c['name']))
}

/** A database as version 1 left it: one archived session with a list item and a detail. */
function versionOneDatabase({ withVersion }: { withVersion: boolean }): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  if (withVersion) db.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '1')")
  db.exec(VERSION_1_SESSIONS)
  db.exec(
    `INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
       detail_mtime_ms, detail_size, archived_at_ms, list_item, detail)
     VALUES ('-p', 's', 1, 2, 1, 1, 2, 3, '{"item":true}', '{"detail":true}')`
  )
  return db
}

describe('applySchema sidecar columns', () => {
  it('gives a fresh database the team spawns and lead slots columns, before the large item and detail', () => {
    const db = new DatabaseSync(':memory:')

    applySchema(db)

    const columns = columnNames(db)
    expect(columns).toContain('team_spawns')
    expect(columns).toContain('lead_slots')
    expect(columns.slice(-2)).toEqual(['list_item', 'detail'])
  })

  it('adds the columns to a version 1 database, keeping its rows and details', () => {
    const db = versionOneDatabase({ withVersion: true })

    const result = applySchema(db)

    expect(result.ok).toBe(true)
    expect(columnNames(db)).toEqual(expect.arrayContaining(['team_spawns', 'lead_slots']))
    expect(db.prepare('SELECT * FROM sessions').all()).toEqual([
      expect.objectContaining({
        list_item: '{"item":true}',
        detail: '{"detail":true}',
        team_spawns: null,
        lead_slots: null
      })
    ])
    expect(storedVersion(db)).toBe('2')
  })

  it('migrates a version 1 database that has no version row', () => {
    const db = versionOneDatabase({ withVersion: false })

    const result = applySchema(db)

    expect(result.ok).toBe(true)
    expect(columnNames(db)).toEqual(expect.arrayContaining(['team_spawns', 'lead_slots']))
    expect(storedVersion(db)).toBe('2')
  })

  it('adds only the missing column when another instance already added the other', () => {
    const db = versionOneDatabase({ withVersion: true })
    db.exec('ALTER TABLE sessions ADD COLUMN team_spawns TEXT')

    const result = applySchema(db)

    expect(result.ok).toBe(true)
    expect(columnNames(db).filter((name) => name === 'team_spawns')).toHaveLength(1)
    expect(columnNames(db)).toContain('lead_slots')
    expect(storedVersion(db)).toBe('2')
  })

  it('leaves a migrated database alone when applied again', () => {
    const db = versionOneDatabase({ withVersion: true })
    applySchema(db)
    const columns = columnNames(db)

    const result = applySchema(db)

    expect(result.ok).toBe(true)
    expect(columnNames(db)).toEqual(columns)
    expect(db.prepare('SELECT COUNT(*) AS n FROM sessions').get()?.['n']).toBe(1)
  })
})

describe('applySchema journal mode', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'beekeeper-archive-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  function journalModeOf(path: string): string {
    const db = new DatabaseSync(path)
    const mode = String(db.prepare('PRAGMA journal_mode').get()?.['journal_mode'])
    db.close()
    return mode
  }

  it('puts a current database in WAL mode', () => {
    const path = join(dir, 'archive.sqlite')
    const db = new DatabaseSync(path)

    applySchema(db)
    db.close()

    expect(journalModeOf(path)).toBe('wal')
  })

  it('leaves the journal mode of a database from a newer schema alone', () => {
    const path = join(dir, 'archive.sqlite')
    const seeded = new DatabaseSync(path)
    seeded.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    seeded.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '3')")
    seeded.close()
    const db = new DatabaseSync(path)

    const result = applySchema(db)
    db.close()

    expect(result).toEqual({ ok: false, error: 'newer-schema' })
    expect(journalModeOf(path)).toBe('delete')
  })
})
