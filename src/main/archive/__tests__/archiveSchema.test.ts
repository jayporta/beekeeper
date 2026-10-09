import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
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

  it('waits only a short time on a locked database', () => {
    const db = new DatabaseSync(':memory:')

    applySchema(db)

    expect(db.prepare('PRAGMA busy_timeout').get()?.['timeout']).toBe(100)
  })
})
