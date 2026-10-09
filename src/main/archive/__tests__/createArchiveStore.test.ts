import type { DatabaseSync } from 'node:sqlite'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_ARCHIVED_DETAIL_CHARS } from '../archiveConstants'
import type { ArchiveStore, SourceState } from '../archiveStoreTypes'
import { createArchiveStore } from '../createArchiveStore'
import { openArchive } from '../openArchive'
import {
  listEntry,
  testDetail,
  testListItem,
  testOkSummary,
  TEST_REF,
  TEST_SOURCE
} from '../testArchiveFixtures'

/** One entry of a `saveListItems` batch. */
interface ListEntry {
  readonly item: SessionListItemDto
  readonly source: SourceState
}

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

describe('saveListItems with one entry', () => {
  it('inserts a row holding the item and its source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

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

    store.saveListItems([listEntry(testListItem({ team }), TEST_SOURCE)])

    const stored: unknown = JSON.parse(String(rows()[0]?.['list_item']))
    expect(stored).toMatchObject({ team: null })
  })

  it('leaves the row alone when saved again with the same source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    clock = 9_000

    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(rows()[0]?.['archived_at_ms']).toBe(5_000)
  })

  it('does no serialization and no write when saved again with the same source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    const stringify = vi.spyOn(JSON, 'stringify')
    const changesBefore = totalChanges()

    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(stringify).not.toHaveBeenCalled()
    expect(totalChanges()).toBe(changesBefore)
  })

  it('updates the row when the size changes', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    clock = 9_000

    store.saveListItems([
      listEntry(testListItem({ sizeBytes: 900 }), { ...TEST_SOURCE, size: 900 })
    ])

    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toMatchObject({ source_size: 900, archived_at_ms: 9_000 })
    expect(JSON.parse(String(rows()[0]?.['list_item']))).toMatchObject({ sizeBytes: 900 })
  })

  it('updates the row when the modification time changes', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    store.saveListItems([listEntry(testListItem(), { ...TEST_SOURCE, mtimeMs: 2_000 })])

    expect(rows()[0]).toMatchObject({ source_mtime_ms: 2_000 })
  })

  it('skips an unchanged session after the store is created over an existing archive', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    const reopened = newStore()
    const stringify = vi.spyOn(JSON, 'stringify')

    reopened.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(stringify).not.toHaveBeenCalled()
  })

  it('leaves a row alone that another store already saved with the same source state', () => {
    const other = newStore()
    other.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    clock = 9_000

    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(rows()[0]?.['archived_at_ms']).toBe(5_000)
  })

  it('clears the stored detail when the source state changes, leaving it pending', () => {
    store.saveListItems([listEntry()])
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    const changed = { ...TEST_SOURCE, size: 900 }

    store.saveListItems([listEntry(testListItem(), changed)])

    expect(rows()[0]).toMatchObject({ detail: null, detail_mtime_ms: null, detail_size: null })
    expect(store.pendingDetails().map((pending) => pending.source)).toEqual([changed])
  })

  it('lists a session again when its transcript returns to the state a cleared detail was stored for', () => {
    store.saveListItems([listEntry()])
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    store.saveListItems([listEntry(testListItem(), { ...TEST_SOURCE, size: 900 })])

    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(store.pendingDetails().map((pending) => pending.source)).toEqual([TEST_SOURCE])
    expect(rows()[0]?.['detail']).toBeNull()
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

    stale.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(rows()[0]).toMatchObject({ format: 1, detail: null, detail_mtime_ms: null })
    expect(JSON.parse(String(rows()[0]?.['list_item']))).toEqual(testListItem())
  })
})

describe('saveDetail', () => {
  it('stores the detail with the source state beside an archived list item', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

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
    expect(store.pendingDetails()).toEqual([])
  })

  it('does no serialization when the same source state is saved again', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    const stringify = vi.spyOn(JSON, 'stringify')

    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(stringify).not.toHaveBeenCalled()
  })

  it('replaces the detail when the source state changes', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: testDetail('first'), source: TEST_SOURCE })
    const next = { ...TEST_SOURCE, size: 700 }

    store.saveDetail(TEST_REF, { detail: testDetail('second'), source: next })

    expect(rows()[0]).toMatchObject({ detail_size: 700 })
    expect(String(rows()[0]?.['detail'])).toContain('second')
  })

  it('skips a detail longer than the limit and logs it once without a path', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    const huge = testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS))

    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })
    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })

    expect(rows()[0]?.['detail']).toBeNull()
    expect(logged).toHaveLength(1)
    expect(logged[0]).not.toContain(TEST_REF.projectDirName)
  })

  it('does not serialize a too-large detail again for the same source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    const huge = testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS))
    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })
    const stringify = vi.spyOn(JSON, 'stringify')

    store.saveDetail(TEST_REF, { detail: huge, source: TEST_SOURCE })

    expect(stringify).not.toHaveBeenCalled()
  })
})

describe('saveListItems', () => {
  const SECOND = { ...TEST_REF, sessionId: '22222222-2222-4222-8222-222222222222' }
  const THIRD = { ...TEST_REF, sessionId: '33333333-3333-4333-8333-333333333333' }

  function entryFor(ref: typeof TEST_REF, source: SourceState = TEST_SOURCE): ListEntry {
    return { item: testListItem({ sessionId: ref.sessionId }), source }
  }

  function entries(): ListEntry[] {
    return [entryFor(TEST_REF), entryFor(SECOND), entryFor(THIRD)]
  }

  function statements(exec: { mock: { calls: unknown[][] } }, sql: string): number {
    return exec.mock.calls.filter(([arg]) => arg === sql).length
  }

  it('stores every entry in one transaction', () => {
    const exec = vi.spyOn(db, 'exec')

    store.saveListItems(entries())

    expect(rows()).toHaveLength(3)
    expect([statements(exec, 'BEGIN'), statements(exec, 'COMMIT')]).toEqual([1, 1])
  })

  it('opens no transaction and serializes nothing when every entry is unchanged', () => {
    store.saveListItems(entries())
    const exec = vi.spyOn(db, 'exec')
    const stringify = vi.spyOn(JSON, 'stringify')

    store.saveListItems(entries())

    expect(statements(exec, 'BEGIN')).toBe(0)
    expect(stringify).not.toHaveBeenCalled()
  })

  it('writes only the changed entries of a batch', () => {
    store.saveListItems(entries())
    clock = 9_000

    store.saveListItems([
      entryFor(TEST_REF),
      entryFor(SECOND, { ...TEST_SOURCE, size: 900 }),
      entryFor(THIRD)
    ])

    expect(
      rows()
        .map((row) => row['archived_at_ms'])
        .sort()
    ).toEqual([5_000, 5_000, 9_000])
  })

  it('stores nothing and keeps the store consistent when an entry fails mid-batch', () => {
    const failing = Object.assign(testListItem({ sessionId: SECOND.sessionId }), {
      toJSON: (): never => {
        throw new Error('serialization failed')
      }
    })

    expect(() =>
      store.saveListItems([entryFor(TEST_REF), { item: failing, source: TEST_SOURCE }])
    ).toThrow('serialization failed')

    expect(rows()).toEqual([])
    expect(db.isTransaction).toBe(false)
    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(false)
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    expect(rows()).toHaveLength(1)
  })
})

describe('saveDetail oversized skip', () => {
  const HUGE = testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS))

  it('stores the skipped source state on the row with no detail', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    store.saveDetail(TEST_REF, { detail: HUGE, source: TEST_SOURCE })

    expect(rows()[0]).toMatchObject({
      detail: null,
      detail_mtime_ms: TEST_SOURCE.mtimeMs,
      detail_size: TEST_SOURCE.size
    })
  })

  it('is remembered by a store created over the archive, which does not retry or log it', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: HUGE, source: TEST_SOURCE })
    logged = []
    const restarted = newStore()
    const stringify = vi.spyOn(JSON, 'stringify')

    restarted.saveDetail(TEST_REF, { detail: HUGE, source: TEST_SOURCE })

    expect(restarted.pendingDetails()).toEqual([])
    expect(stringify).not.toHaveBeenCalled()
    expect(logged).toEqual([])
  })

  it('is replaced by a stored detail once the transcript changes to a size that fits', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: HUGE, source: TEST_SOURCE })
    const next = { ...TEST_SOURCE, size: 700 }
    store.saveListItems([listEntry(testListItem(), next)])

    store.saveDetail(TEST_REF, { detail: testDetail(), source: next })

    expect(rows()[0]).toMatchObject({ detail_size: 700 })
    expect(rows()[0]?.['detail']).not.toBeNull()
  })

  it('lists the session again once its transcript changes after the skip', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: HUGE, source: TEST_SOURCE })

    store.saveListItems([listEntry(testListItem(), { ...TEST_SOURCE, size: 700 })])

    expect(store.pendingDetails()).toHaveLength(1)
  })
})

describe('skipDetail', () => {
  it('takes a pending session out of the pending list for its current source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    store.skipDetail(TEST_REF)

    expect(store.pendingDetails()).toEqual([])
  })

  it('lists the session again once its transcript changes', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.skipDetail(TEST_REF)

    store.saveListItems([listEntry(testListItem(), { ...TEST_SOURCE, size: 900 })])

    expect(store.pendingDetails()).toHaveLength(1)
  })

  it('lasts only for the life of the store: a store created over the archive lists it again', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.skipDetail(TEST_REF)

    expect(newStore().pendingDetails()).toHaveLength(1)
  })

  it('writes nothing to the archive', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    const changes = totalChanges()

    store.skipDetail(TEST_REF)

    expect(totalChanges()).toBe(changes)
  })

  it('does nothing for a session that was never archived', () => {
    store.skipDetail(TEST_REF)

    expect(store.pendingDetails()).toEqual([])
    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(false)
  })
})

describe('hasListItem', () => {
  it('is true only for the source state the item was stored with', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(true)
    expect(store.hasListItem(TEST_REF, { ...TEST_SOURCE, size: 1 })).toBe(false)
    expect(store.hasListItem(TEST_REF, { ...TEST_SOURCE, mtimeMs: 1 })).toBe(false)
  })

  it('is false for a session never stored', () => {
    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(false)
  })

  it('is true after the store is created over an archive that holds the item', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])

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
    store.saveListItems([listEntry(testListItem({ summary: testOkSummary(777) }), TEST_SOURCE)])

    expect(store.pendingDetails()).toEqual([
      { ref: TEST_REF, source: TEST_SOURCE, activityLatestMs: 777 }
    ])
  })

  it('has no last message for a summary without timestamps', () => {
    store.saveListItems([listEntry(testListItem({ summary: testOkSummary(null) }), TEST_SOURCE)])

    expect(store.pendingDetails()[0]?.activityLatestMs).toBeNull()
  })

  it('leaves out a session whose detail matches its source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(store.pendingDetails()).toEqual([])
  })

  it('lists a session again once its transcript changes after its detail was stored', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    const changed = { ...TEST_SOURCE, size: 900 }

    store.saveListItems([listEntry(testListItem(), changed)])

    expect(store.pendingDetails().map((pending) => pending.source)).toEqual([changed])
  })

  it('leaves out a session whose detail was skipped as too large for its source state', () => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.saveDetail(TEST_REF, {
      detail: testDetail('x'.repeat(MAX_ARCHIVED_DETAIL_CHARS)),
      source: TEST_SOURCE
    })

    expect(store.pendingDetails()).toEqual([])
  })

  it('lists a session again once its transcript modification time changes after its detail was stored', () => {
    store.saveListItems([listEntry()])
    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    const changed = { ...TEST_SOURCE, mtimeMs: 2_000 }

    store.saveListItems([listEntry(testListItem(), changed)])

    expect(store.pendingDetails().map((pending) => pending.source)).toEqual([changed])
  })

  it('does not settle a session of the same id in another folder', () => {
    const other = { ...TEST_REF, projectDirName: '-other' }
    store.saveListItems([listEntry(), listEntry(testListItem({ projectDirName: '-other' }))])

    store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(store.pendingDetails().map((pending) => pending.ref)).toEqual([other])
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
    store.saveListItems([listEntry(testListItem({ summary: testOkSummary(5) }), TEST_SOURCE)])
    store.saveListItems([listEntry(testListItem({ sessionId: OTHER_REF.sessionId }), TEST_SOURCE)])
    store.saveDetail(OTHER_REF, { detail: testDetail(), source: TEST_SOURCE })

    expect(newStore().pendingDetails()).toEqual([
      { ref: TEST_REF, source: TEST_SOURCE, activityLatestMs: 5 }
    ])
  })
})

describe('after close', () => {
  beforeEach(() => {
    store.saveListItems([listEntry(testListItem(), TEST_SOURCE)])
    store.close()
  })

  it('ignores a list item batch without throwing or logging', () => {
    const changed = { ...TEST_SOURCE, size: 900 }

    expect(() => store.saveListItems([{ item: testListItem(), source: changed }])).not.toThrow()
    expect(logged).toEqual([])
  })

  it('ignores a detail without throwing or logging', () => {
    expect(() =>
      store.saveDetail(TEST_REF, { detail: testDetail(), source: TEST_SOURCE })
    ).not.toThrow()
    expect(logged).toEqual([])
  })

  it('ignores a skip, leaving the session pending', () => {
    store.skipDetail(TEST_REF)

    expect(store.pendingDetails()).toHaveLength(1)
  })

  it('can be closed again', () => {
    expect(() => store.close()).not.toThrow()
  })
})

describe('close', () => {
  it('closes the database', () => {
    store.close()

    expect(() => db.prepare('SELECT 1')).toThrow()
  })
})
