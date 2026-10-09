import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openArchive } from '../openArchive'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'beekeeper-archive-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function collectLog(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = []
  return { lines, log: (line) => lines.push(line) }
}

describe('openArchive', () => {
  it('opens an in-memory archive with the schema applied', () => {
    const db = openArchive(':memory:')

    const row = db?.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
    expect(row?.['value']).toBe('1')
  })

  it('creates the archive file and its missing parent folder', () => {
    const path = join(dir, 'nested', 'archive.sqlite')

    const db = openArchive(path)
    db?.close()

    const reopened = new DatabaseSync(path)
    const row = reopened.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get()
    reopened.close()
    expect(row?.['value']).toBe('1')
  })

  it('returns null and logs once when the file holds a newer schema', () => {
    const path = join(dir, 'archive.sqlite')
    const seeded = new DatabaseSync(path)
    seeded.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    seeded.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '2')")
    seeded.close()
    const { lines, log } = collectLog()

    const db = openArchive(path, log)

    expect(db).toBeNull()
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('newer-schema')
  })

  it('returns null when the file is not a database', async () => {
    const path = join(dir, 'archive.sqlite')
    await writeFile(path, Buffer.from('this is definitely not a sqlite database file '.repeat(40)))
    const { log } = collectLog()

    const db = openArchive(path, log)

    expect(db).toBeNull()
  })

  it('logs one line that names no path for a failure', async () => {
    const path = join(dir, 'archive.sqlite')
    await writeFile(path, Buffer.from('this is definitely not a sqlite database file '.repeat(40)))
    const { lines, log } = collectLog()

    openArchive(path, log)

    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain(dir)
    expect(lines[0]).not.toContain('archive.sqlite')
  })

  it('returns null when the folder cannot be created', async () => {
    const blocker = join(dir, 'blocker')
    await writeFile(blocker, 'a file where a folder is needed')
    const { lines, log } = collectLog()

    const db = openArchive(join(blocker, 'archive.sqlite'), log)

    expect(db).toBeNull()
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain(dir)
  })
})
