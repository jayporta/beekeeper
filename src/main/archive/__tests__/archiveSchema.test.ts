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
    db.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '2')")

    const result = applySchema(db)

    expect(result).toEqual({ ok: false, error: 'newer-schema' })
    expect(tableNames(db)).toEqual(['meta'])
    expect(storedVersion(db)).toBe('2')
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
    seeded.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '2')")
    seeded.close()
    const db = new DatabaseSync(path)

    const result = applySchema(db)
    db.close()

    expect(result).toEqual({ ok: false, error: 'newer-schema' })
    expect(journalModeOf(path)).toBe('delete')
  })
})
