import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openArchiveStore } from '../openArchiveStore'
import { listEntry, testListItem, TEST_SOURCE } from '../testArchiveFixtures'

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

describe('openArchiveStore', () => {
  it('returns a store that saves to the archive file', () => {
    const path = join(dir, 'archive.sqlite')

    const store = openArchiveStore(path)
    store?.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store?.close()

    const reopened = new DatabaseSync(path)
    const row = reopened.prepare('SELECT COUNT(*) AS n FROM sessions').get()
    reopened.close()
    expect(row?.['n']).toBe(1)
  })

  it('returns null when the archive cannot be opened', () => {
    const path = join(dir, 'archive.sqlite')
    const seeded = new DatabaseSync(path)
    seeded.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    seeded.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '2')")
    seeded.close()
    const { log } = collectLog()

    expect(openArchiveStore(path, log)).toBeNull()
  })

  it('returns null and logs once when the store cannot read the tables', () => {
    const path = join(dir, 'archive.sqlite')
    const seeded = new DatabaseSync(path)
    seeded.exec('CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    seeded.exec("INSERT INTO meta (key, value) VALUES ('schema_version', '1')")
    seeded.exec('CREATE TABLE sessions (unrelated TEXT)')
    seeded.close()
    const { lines, log } = collectLog()

    const store = openArchiveStore(path, log)

    expect(store).toBeNull()
    expect(lines).toHaveLength(1)
    expect(lines[0]).not.toContain(dir)
  })
})
