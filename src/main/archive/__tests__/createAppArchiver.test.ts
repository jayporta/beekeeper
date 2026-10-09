import { DatabaseSync } from 'node:sqlite'
import { stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../../ipc/testIpcTree'
import { ARCHIVE_DETAIL_AFTER_DAYS, DAY_MS } from '../archiveConstants'
import { createAppArchiver } from '../createAppArchiver'
import type { ArchiveStore } from '../archiveStoreTypes'
import { listEntry, testListItem } from '../testArchiveFixtures'
import { createArchiveStore } from '../createArchiveStore'
import { openArchive } from '../openArchive'

const ctx = registerIpcTestTree()
const REF = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

let db: DatabaseSync
let store: ArchiveStore

beforeEach(() => {
  const opened = openArchive(':memory:')
  if (opened === null) throw new Error('the in-memory archive should open')
  db = opened
  store = createArchiveStore(db, { log: () => {} })
})

function archiver(daysAfterSession: number): ReturnType<typeof createAppArchiver> {
  const now = (): number => Date.now() + daysAfterSession * DAY_MS
  return createAppArchiver({ deps: { ...ctx.deps, now }, store })
}

async function sourceState(): Promise<{ mtimeMs: number; size: number }> {
  const info = await stat(ctx.tree.sessionPath)
  return { mtimeMs: info.mtimeMs, size: info.size }
}

function detailRows(): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE detail IS NOT NULL').get()
  return Number(row?.['n'])
}

describe('createAppArchiver', () => {
  it('archives the list item of a session found in a project', async () => {
    await archiver(0).runPass()

    expect(store.hasListItem(REF, await sourceState())).toBe(true)
  })

  it('leaves the detail of a session still active', async () => {
    await archiver(ARCHIVE_DETAIL_AFTER_DAYS - 1).runPass()

    expect(detailRows()).toBe(0)
  })

  it('archives the detail of a session quiet for the waiting period', async () => {
    await archiver(ARCHIVE_DETAIL_AFTER_DAYS).runPass()

    expect(detailRows()).toBe(1)
  })

  it('does not list a project again when none of its sessions changed', async () => {
    let summaryReads = 0
    const deps = {
      ...ctx.deps,
      summaryCache: {
        read: (file: Parameters<typeof ctx.deps.summaryCache.read>[0]) => {
          summaryReads += 1
          return ctx.deps.summaryCache.read(file)
        }
      }
    }
    const quiet = createAppArchiver({ deps, store })
    await quiet.runPass()
    const readsAfterFirst = summaryReads

    await quiet.runPass()

    expect(readsAfterFirst).toBeGreaterThan(0)
    expect(summaryReads).toBe(readsAfterFirst)
  })

  it('archives a detail left pending by an earlier pass once the session has gone quiet', async () => {
    await archiver(0).runPass()
    expect(detailRows()).toBe(0)

    await archiver(ARCHIVE_DETAIL_AFTER_DAYS).runPass()

    expect(detailRows()).toBe(1)
  })

  it("scans details through its own scan cache, leaving the UI's alone", async () => {
    const uiCache = { gets: 0, sets: 0 }
    const deps = {
      ...ctx.deps,
      now: () => Date.now() + ARCHIVE_DETAIL_AFTER_DAYS * DAY_MS,
      scanCache: {
        get: (key: string) => {
          uiCache.gets += 1
          return ctx.deps.scanCache.get(key)
        },
        set: (...args: Parameters<typeof ctx.deps.scanCache.set>) => {
          uiCache.sets += 1
          ctx.deps.scanCache.set(...args)
        }
      }
    }

    await createAppArchiver({ deps, store }).runPass()

    expect(detailRows()).toBe(1)
    expect(uiCache).toEqual({ gets: 0, sets: 0 })
  })

  describe('a session whose scan is incomplete', () => {
    const metaPath = (): string =>
      join(
        ctx.tree.home,
        '.claude',
        'projects',
        TEST_PROJECT,
        TEST_SESSION_ID,
        'subagents',
        'agent-a1.meta.json'
      )

    it('is not archived, stays pending, and is archived once a later scan is complete', async () => {
      await writeFile(metaPath(), 'not json')
      const later = archiver(ARCHIVE_DETAIL_AFTER_DAYS)

      await later.runPass()
      const rowsAfterIncomplete = detailRows()
      const stillPending = store.pendingDetails().map((pending) => pending.ref.sessionId)
      await writeFile(metaPath(), JSON.stringify({ agentType: 'Explore' }))
      await later.runPass()

      expect(rowsAfterIncomplete).toBe(0)
      expect(stillPending).toEqual([TEST_SESSION_ID])
      expect(detailRows()).toBe(1)
    })
  })

  describe('a pending session whose transcript is gone', () => {
    const GHOST = {
      projectDirName: TEST_PROJECT,
      sessionId: '9f9f9f9f-9999-4999-8999-99999999999a'
    }

    function countingDeps(counter: { scans: number }): typeof ctx.deps {
      return {
        ...ctx.deps,
        now: () => Date.now() + ARCHIVE_DETAIL_AFTER_DAYS * DAY_MS,
        scans: {
          run: (key, task) => {
            counter.scans += 1
            return ctx.deps.scans.run(key, task)
          }
        }
      }
    }

    it('is never scanned and is not pending in the next pass', async () => {
      store.saveListItems([listEntry(testListItem(GHOST), { mtimeMs: 1_000, size: 10 })])
      const counter = { scans: 0 }
      const archiver = createAppArchiver({ deps: countingDeps(counter), store })

      await archiver.runPass()
      const pendingAfter = store.pendingDetails().map((pending) => pending.ref.sessionId)
      await archiver.runPass()

      expect(counter.scans).toBe(1)
      expect(pendingAfter).not.toContain(GHOST.sessionId)
    })
  })
})
