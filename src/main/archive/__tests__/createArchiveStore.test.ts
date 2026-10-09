import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_ARCHIVED_DETAIL_CHARS } from '../archiveConstants'
import { createArchiveStore, type ArchiveStore } from '../createArchiveStore'
import { openArchive } from '../openArchive'
import {
  testDetail,
  testListItem,
  testOkSummary,
  TEST_REF,
  TEST_SOURCE
} from '../testArchiveFixtures'

let db: DatabaseSync
let clock: number
let logged: string[]
let store: ArchiveStore

function newStore(): ArchiveStore {
  return createArchiveStore(db, { now: () => clock, log: (line) => logged.push(line) })
}

beforeEach(() => {
  const opened = openArchive(':memory:')
  if (opened === null) throw new Error('the in-memory archive should open')
  db = opened
  clock = 5_000
  logged = []
  store = newStore()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function rows(): readonly Record<string, unknown>[] {
  return db.prepare('SELECT * FROM sessions').all()
}

function totalChanges(): number {
  return Number(db.prepare('SELECT total_changes() AS n').get()?.['n'])
}

describe('saveListItem', () => {
  it('inserts a row holding the item and its source state', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(rows()).toHaveLength(1)
    const [row] = rows()
    expect(row).toMatchObject({
      project_dir: TEST_REF.projectDirName,
      session_id: TEST_REF.sessionId,
      source_mtime_ms: TEST_SOURCE.mtimeMs,
      source_size: TEST_SOURCE.size,
      format: 1,
      archived_at_ms: 5_000
    })
    expect(JSON.parse(String(row?.['list_item']))).toEqual(testListItem())
  })

  it('stores the team as null', () => {
    const team = {
      kind: 'teammate',
      lead: { projectDirName: '-work-app', sessionId: '22222222-2222-4222-8222-222222222222' },
      joinedBy: 'spawn',
      stopped: false
    } as const

    store.saveListItem(testListItem({ team }), TEST_SOURCE)

    const stored: unknown = JSON.parse(String(rows()[0]?.['list_item']))
    expect(stored).toMatchObject({ team: null })
  })

  it('leaves the row alone when saved again with the same source state', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    clock = 9_000

    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(rows()[0]?.['archived_at_ms']).toBe(5_000)
  })

  it('does no serialization and no write when saved again with the same source state', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    const stringify = vi.spyOn(JSON, 'stringify')
    const changesBefore = totalChanges()

    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(stringify).not.toHaveBeenCalled()
    expect(totalChanges()).toBe(changesBefore)
  })

  it('updates the row when the size changes', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    clock = 9_000

    store.saveListItem(testListItem({ sizeBytes: 900 }), { ...TEST_SOURCE, size: 900 })

    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toMatchObject({ source_size: 900, archived_at_ms: 9_000 })
    expect(JSON.parse(String(rows()[0]?.['list_item']))).toMatchObject({ sizeBytes: 900 })
  })

  it('updates the row when the modification time changes', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)

    store.saveListItem(testListItem(), { ...TEST_SOURCE, mtimeMs: 2_000 })

    expect(rows()[0]).toMatchObject({ source_mtime_ms: 2_000 })
  })

  it('skips an unchanged session after the store is created over an existing archive', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    const reopened = newStore()
    const stringify = vi.spyOn(JSON, 'stringify')

    reopened.saveListItem(testListItem(), TEST_SOURCE)

    expect(stringify).not.toHaveBeenCalled()
  })

  it('leaves a row alone that another store already saved with the same source state', () => {
    const other = newStore()
    other.saveListItem(testListItem(), TEST_SOURCE)
    clock = 9_000

    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(rows()[0]?.['archived_at_ms']).toBe(5_000)
  })

  it('rewrites a row stored in another format and drops its detail', () => {
    db.prepare(
      `INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
         list_item, detail, detail_mtime_ms, detail_size, archived_at_ms)
       VALUES (?, ?, ?, ?, 0, '{}', '{}', ?, ?, 1)`
    ).run(
      TEST_REF.projectDirName,
      TEST_REF.sessionId,
      TEST_SOURCE.mtimeMs,
      TEST_SOURCE.size,
      TEST_SOURCE.mtimeMs,
      TEST_SOURCE.size
    )
    const stale = newStore()
    expect(stale.hasDetail(TEST_REF, TEST_SOURCE)).toBe(false)

    stale.saveListItem(testListItem(), TEST_SOURCE)

    expect(rows()[0]).toMatchObject({ format: 1, detail: null, detail_mtime_ms: null })
    expect(JSON.parse(String(rows()[0]?.['list_item']))).toEqual(testListItem())
  })
})

describe('saveDetail', () => {
  it('stores the detail with the source state beside an archived list item', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)

    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(rows()[0]).toMatchObject({
      detail_mtime_ms: TEST_SOURCE.mtimeMs,
      detail_size: TEST_SOURCE.size
    })
    expect(JSON.parse(String(rows()[0]?.['detail']))).toEqual(testDetail())
  })

  it('ignores a detail for a session with no archived list item', () => {
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(rows()).toHaveLength(0)
    expect(store.hasDetail(TEST_REF, TEST_SOURCE)).toBe(false)
  })

  it('does no serialization when the same source state is saved again', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    const stringify = vi.spyOn(JSON, 'stringify')

    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(stringify).not.toHaveBeenCalled()
  })

  it('replaces the detail when the source state changes', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail('first'), source: TEST_SOURCE })
    const next = { ...TEST_SOURCE, size: 700 }

    store.saveDetail(TEST_REF, { detail: testDetail('second'), source: next })

    expect(rows()[0]).toMatchObject({ detail_size: 700 })
    expect(String(rows()[0]?.['detail'])).toContain('second')
  })

  it('skips a detail longer than the limit and logs it once without a path', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    const huge = testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS))

    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })
    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })

    expect(rows()[0]?.['detail']).toBeNull()
    expect(logged).toHaveLength(1)
    expect(logged[0]).not.toContain(TEST_REF.projectDirName)
  })

  it('does not serialize a too-large detail again for the same source state', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    const huge = testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS))
    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })
    const stringify = vi.spyOn(JSON, 'stringify')

    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })

    expect(stringify).not.toHaveBeenCalled()
  })
})

describe('hasDetail', () => {
  it('is true for a state whose detail was skipped as too large, so nothing is retried', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, {
      detail: testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS)),
      source: TEST_SOURCE
    })

    expect(store.hasDetail(TEST_REF, TEST_SOURCE)).toBe(true)
    expect(store.hasDetail(TEST_REF, { ...TEST_SOURCE, size: 1 })).toBe(false)
  })

  it('is false before any detail is stored', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(store.hasDetail(TEST_REF, TEST_SOURCE)).toBe(false)
  })

  it('is true only for the source state the detail was stored with', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(store.hasDetail(TEST_REF, TEST_SOURCE)).toBe(true)
    expect(store.hasDetail(TEST_REF, { ...TEST_SOURCE, mtimeMs: 2_000 })).toBe(false)
    expect(store.hasDetail(TEST_REF, { ...TEST_SOURCE, size: 1 })).toBe(false)
  })

  it('is true after the store is created over an archive that holds the detail', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(newStore().hasDetail(TEST_REF, TEST_SOURCE)).toBe(true)
  })

  it('is false for a session in another folder', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(store.hasDetail({ ...TEST_REF, projectDirName: '-other' }, TEST_SOURCE)).toBe(false)
  })
})

describe('hasListItem', () => {
  it('is true only for the source state the item was stored with', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(true)
    expect(store.hasListItem(TEST_REF, { ...TEST_SOURCE, size: 1 })).toBe(false)
    expect(store.hasListItem(TEST_REF, { ...TEST_SOURCE, mtimeMs: 1 })).toBe(false)
  })

  it('is false for a session never stored', () => {
    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(false)
  })

  it('is true after the store is created over an archive that holds the item', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)

    expect(newStore().hasListItem(TEST_REF, TEST_SOURCE)).toBe(true)
  })

  it('is false for a row stored in another format', () => {
    db.prepare(
      `INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
         list_item, archived_at_ms)
       VALUES (?, ?, ?, ?, 0, '{}', 1)`
    ).run(TEST_REF.projectDirName, TEST_REF.sessionId, TEST_SOURCE.mtimeMs, TEST_SOURCE.size)

    expect(newStore().hasListItem(TEST_REF, TEST_SOURCE)).toBe(false)
  })
})

describe('pendingDetails', () => {
  const OTHER_REF = { ...TEST_REF, sessionId: '22222222-2222-4222-8222-222222222222' }

  it('lists a session with an archived item and no detail, with its source state and last message', () => {
    store.saveListItem(testListItem({ summary: testOkSummary(777) }), TEST_SOURCE)

    expect(store.pendingDetails()).toEqual([
      { ref: TEST_REF, source: TEST_SOURCE, activityLatestMs: 777 }
    ])
  })

  it('has no last message for a summary without timestamps', () => {
    store.saveListItem(testListItem({ summary: testOkSummary(null) }), TEST_SOURCE)

    expect(store.pendingDetails()[0]?.activityLatestMs).toBeNull()
  })

  it('leaves out a session whose detail matches its source state', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(store.pendingDetails()).toEqual([])
  })

  it('lists a session again once its transcript changes after its detail was stored', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    const changed = { ...TEST_SOURCE, size: 900 }

    store.saveListItem(testListItem(), changed)

    expect(store.pendingDetails().map((pending) => pending.source)).toEqual([changed])
  })

  it('leaves out a session whose detail was skipped as too large for its source state', () => {
    store.saveListItem(testListItem(), TEST_SOURCE)
    store.saveDetail(TEST_REF, {
      detail: testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS)),
      source: TEST_SOURCE
    })

    expect(store.pendingDetails()).toEqual([])
  })

  it('leaves out a row stored in another format', () => {
    db.prepare(
      `INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
         list_item, archived_at_ms)
       VALUES (?, ?, ?, ?, 0, '{}', 1)`
    ).run(TEST_REF.projectDirName, TEST_REF.sessionId, TEST_SOURCE.mtimeMs, TEST_SOURCE.size)

    expect(newStore().pendingDetails()).toEqual([])
  })

  it('lists sessions after the store is created over an archive that holds them', () => {
    store.saveListItem(testListItem({ summary: testOkSummary(5) }), TEST_SOURCE)
    store.saveListItem(testListItem({ sessionId: OTHER_REF.sessionId }), TEST_SOURCE)
    store.saveDetail(OTHER_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(newStore().pendingDetails()).toEqual([
      { ref: TEST_REF, source: TEST_SOURCE, activityLatestMs: 5 }
    ])
  })
})

describe('close', () => {
  it('closes the database', () => {
    store.close()

    expect(() => db.prepare('SELECT 1')).toThrow()
  })
})
