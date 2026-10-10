import type { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArchiveStore } from '../archiveStoreTypes'
import { createArchiveStore } from '../createArchiveStore'
import { openArchive } from '../openArchive'
import {
  listEntry,
  NO_TEAM_SPAWNS,
  testDetail,
  testListItem,
  testOkSummary,
  TEST_LEAD_SLOTS,
  TEST_REF,
  TEST_SOURCE,
  TEST_TEAM_SPAWNS
} from '../testArchiveFixtures'

const ITEM = testListItem({ summary: testOkSummary(5) })
const NONE: ReadonlySet<string> = new Set()
const FOLDER = TEST_REF.projectDirName

let db: DatabaseSync
let logged: string[]

function newStore(): ArchiveStore {
  return createArchiveStore(db, { now: () => 5_000, log: (line) => logged.push(line) })
}

beforeEach(() => {
  const opened = openArchive(':memory:')
  if (opened === null) throw new Error('the in-memory archive should open')
  db = opened
  logged = []
})

afterEach(() => {
  vi.restoreAllMocks()
})

function totalChanges(): number {
  return Number(db.prepare('SELECT total_changes() AS n').get()?.['n'])
}

/** Writes a row the way version 1 did: a list item at the current format, and no sidecars. */
function seedUnbackfilledRow(options: { withDetail?: boolean } = {}): void {
  db.prepare(
    `INSERT INTO sessions (project_dir, session_id, source_mtime_ms, source_size, format,
       detail_mtime_ms, detail_size, archived_at_ms, list_item, detail)
     VALUES (?, ?, ?, ?, 1, ?, ?, 1, ?, ?)`
  ).run(
    TEST_REF.projectDirName,
    TEST_REF.sessionId,
    TEST_SOURCE.mtimeMs,
    TEST_SOURCE.size,
    options.withDetail ? TEST_SOURCE.mtimeMs : null,
    options.withDetail ? TEST_SOURCE.size : null,
    JSON.stringify(ITEM),
    options.withDetail ? JSON.stringify(testDetail()) : null
  )
}

/** Overwrites one sidecar column of the stored row, behind the store's back. */
function setColumn(column: 'team_spawns' | 'lead_slots', value: string | null): void {
  db.prepare(`UPDATE sessions SET ${column} = ?`).run(value)
}

describe('readSessions', () => {
  it('returns the item with the team spawns and lead slots it was saved with', () => {
    const store = newStore()
    store.saveListItems([
      { ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS }
    ])

    expect(store.readSessions(FOLDER, NONE)).toEqual([
      { item: { ...ITEM, team: null }, teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS }
    ])
  })

  it('reads the sidecars saved by an earlier store over the same archive', () => {
    newStore().saveListItems([
      { ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS }
    ])

    const [session] = newStore().readSessions(FOLDER, NONE)

    expect(session).toMatchObject({ teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS })
  })

  it('returns null lead slots for a session with no lead usage, beside its spawns', () => {
    const store = newStore()
    store.saveListItems([{ ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS, leadSlots: null }])

    const [session] = store.readSessions(FOLDER, NONE)

    expect(session).toMatchObject({ teamSpawns: TEST_TEAM_SPAWNS, leadSlots: null })
  })

  it('returns null sidecars, and logs nothing, for a row written before they existed', () => {
    seedUnbackfilledRow()

    const sessions = newStore().readSessions(FOLDER, NONE)

    expect(sessions).toEqual([{ item: ITEM, teamSpawns: null, leadSlots: null }])
    expect(logged).toEqual([])
  })

  it('leaves out the sessions it is told to exclude', () => {
    const store = newStore()
    store.saveListItems([listEntry(ITEM)])

    expect(store.readSessions(FOLDER, new Set([TEST_REF.sessionId]))).toEqual([])
  })

  it('keeps readListItems answering the items alone', () => {
    const store = newStore()
    store.saveListItems([{ ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS }])

    expect(store.readListItems(FOLDER, NONE)).toEqual([{ ...ITEM, team: null }])
  })
})

describe('readSessions with a corrupt sidecar', () => {
  it.each([
    ['team_spawns', '{corrupt', 'team spawns', 'invalid-json'],
    ['team_spawns', '{"spawns":"no"}', 'team spawns', 'invalid-shape'],
    ['lead_slots', '[', 'lead slots', 'invalid-json'],
    ['lead_slots', '{"slots":[{"slot":"x"}]}', 'lead slots', 'invalid-shape']
  ] as const)(
    'reads %s as null, keeps the item and the other sidecar, and logs it',
    (column, value, label, kind) => {
      const store = newStore()
      store.saveListItems([
        { ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS }
      ])
      setColumn(column, value)

      const [session] = newStore().readSessions(FOLDER, NONE)

      expect(session?.item).toEqual({ ...ITEM, team: null })
      expect(column === 'team_spawns' ? session?.teamSpawns : session?.leadSlots).toBeNull()
      expect(column === 'team_spawns' ? session?.leadSlots : session?.teamSpawns).not.toBeNull()
      expect(logged).toEqual([`Beekeeper archive skipped an unreadable ${label} column (${kind}).`])
    }
  )

  it('logs each kind of corrupt sidecar once, across rows and reads', () => {
    const store = newStore()
    const second = { ...TEST_REF, sessionId: '22222222-2222-4222-8222-222222222222' }
    store.saveListItems([
      { ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS },
      { ...listEntry({ ...ITEM, sessionId: second.sessionId }), teamSpawns: TEST_TEAM_SPAWNS }
    ])
    db.prepare('UPDATE sessions SET team_spawns = ?').run('{corrupt')

    const fresh = newStore()
    fresh.readSessions(FOLDER, NONE)
    fresh.readSessions(FOLDER, NONE)

    expect(logged).toEqual([
      'Beekeeper archive skipped an unreadable team spawns column (invalid-json).'
    ])
  })
})

describe('readSessions caching', () => {
  it('parses a row and its sidecars once: a second read answers from memory', () => {
    const store = newStore()
    store.saveListItems([
      { ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS }
    ])
    const first = store.readSessions(FOLDER, NONE)
    const parse = vi.spyOn(JSON, 'parse')

    const second = store.readSessions(FOLDER, NONE)

    expect(parse).not.toHaveBeenCalled()
    expect(second[0]).toBe(first[0])
  })

  it('reads the sidecars again once a save rewrites the row', () => {
    const store = newStore()
    store.saveListItems([{ ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS }])
    store.readSessions(FOLDER, NONE)
    const changed = { ...TEST_SOURCE, size: 900 }

    store.saveListItems([{ ...listEntry(ITEM, changed), teamSpawns: NO_TEAM_SPAWNS }])

    expect(store.readSessions(FOLDER, NONE)[0]?.teamSpawns).toEqual(NO_TEAM_SPAWNS)
  })
})

describe('backfilling a row that has no sidecars', () => {
  it('does not count the stored list item as current, so the session is listed again', () => {
    seedUnbackfilledRow()

    expect(newStore().hasListItem(TEST_REF, TEST_SOURCE)).toBe(false)
  })

  it('rewrites the row once with its sidecars, though its source state is unchanged', () => {
    seedUnbackfilledRow()
    const store = newStore()

    store.saveListItems([
      { ...listEntry(ITEM), teamSpawns: TEST_TEAM_SPAWNS, leadSlots: TEST_LEAD_SLOTS }
    ])

    expect(store.readSessions(FOLDER, NONE)[0]).toMatchObject({
      teamSpawns: TEST_TEAM_SPAWNS,
      leadSlots: TEST_LEAD_SLOTS
    })
    expect(newStore().readSessions(FOLDER, NONE)[0]).toMatchObject({
      teamSpawns: TEST_TEAM_SPAWNS,
      leadSlots: TEST_LEAD_SLOTS
    })
    expect(store.hasListItem(TEST_REF, TEST_SOURCE)).toBe(true)
  })

  it('writes nothing the second time it is saved with the same source state', () => {
    seedUnbackfilledRow()
    const store = newStore()
    store.saveListItems([listEntry(ITEM)])
    const changes = totalChanges()

    store.saveListItems([listEntry(ITEM)])
    newStore().saveListItems([listEntry(ITEM)])

    expect(totalChanges()).toBe(changes)
  })

  it('keeps the detail scanned from the same source state', () => {
    seedUnbackfilledRow({ withDetail: true })
    const store = newStore()

    store.saveListItems([listEntry(ITEM)])

    expect(store.readDetail(TEST_REF)).toEqual(testDetail())
    expect(store.pendingDetails()).toEqual([])
  })

  it('stores JSON null for lead slots a transcript had none of, so they are not backfilled again', () => {
    const store = newStore()

    store.saveListItems([listEntry(ITEM)])

    const row = db.prepare('SELECT team_spawns, lead_slots FROM sessions').get()
    expect(row).toEqual({ team_spawns: JSON.stringify(NO_TEAM_SPAWNS), lead_slots: 'null' })
  })
})
