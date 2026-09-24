import { utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSessionSummaryCache } from '../../../core/transcript/summary/sessionSummaryCache'
import { MAX_CONCURRENT_SUMMARIES } from '../createIpcDeps'
import type { IpcDeps } from '../ipcDeps'
import { listSessionsHandler } from '../listSessionsHandler'
import { TEST_PROJECT, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

describe('listSessionsHandler summary reads', () => {
  const listRequest = { projectDirName: TEST_PROJECT }

  it('reads each transcript once for two concurrent listings on a cold project', async () => {
    let reads = 0
    let runs = 0
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const inner = createSessionSummaryCache()
    const summaryCache: IpcDeps['summaryCache'] = {
      read: async (file) => {
        reads += 1
        await gate
        return inner.read(file)
      }
    }
    // Holds the first read open until the second listing has asked for the same file.
    const summaries: IpcDeps['summaries'] = {
      run: (key, task) => {
        runs += 1
        if (runs === 2) release()
        return ctx.deps.summaries.run(key, task)
      }
    }
    const gated = { ...ctx.deps, summaryCache, summaries }
    const both = await Promise.all([
      listSessionsHandler(gated, listRequest),
      listSessionsHandler(gated, listRequest)
    ])
    expect(both.map((result) => result.ok)).toEqual([true, true])
    expect(reads).toBe(1)
  })

  it('never runs more summary reads at once than the pool allows', async () => {
    let active = 0
    let peak = 0
    const summaryCache: IpcDeps['summaryCache'] = {
      read: async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
        return { ok: false, error: { reason: 'unreadable', code: 'ENOENT' } }
      }
    }
    const projectDir = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT)
    for (let index = 0; index < 8; index += 1) {
      const id = `1a1a1a1a-1111-4111-8111-${String(index).padStart(12, '0')}`
      await writeFile(join(projectDir, `${id}.jsonl`), '')
    }
    const result = await listSessionsHandler({ ...ctx.deps, summaryCache }, listRequest)
    expect(result.ok && result.value.length).toBe(9)
    expect(peak).toBe(MAX_CONCURRENT_SUMMARIES)
  })

  describe('sharing by file state', () => {
    /** Runs two listings, changing the transcript's mtime between their discoveries. */
    async function readsForTwoListings(changeBetween: boolean): Promise<number> {
      let reads = 0
      let runs = 0
      const signal = {
        release: (): void => {},
        firstRead: (): void => {},
        secondRun: (): void => {}
      }
      const gate = new Promise<void>((resolve) => {
        signal.release = resolve
      })
      const firstReadStarted = new Promise<void>((resolve) => {
        signal.firstRead = resolve
      })
      const secondRunCalled = new Promise<void>((resolve) => {
        signal.secondRun = resolve
      })
      const inner = createSessionSummaryCache()
      const summaryCache: IpcDeps['summaryCache'] = {
        read: async (file) => {
          reads += 1
          if (reads === 1) signal.firstRead()
          await gate
          return inner.read(file)
        }
      }
      const summaries: IpcDeps['summaries'] = {
        run: (key, task) => {
          runs += 1
          if (runs === 2) signal.secondRun()
          return ctx.deps.summaries.run(key, task)
        }
      }
      const gated = { ...ctx.deps, summaryCache, summaries }
      const first = listSessionsHandler(gated, listRequest)
      await firstReadStarted
      if (changeBetween) await utimes(ctx.tree.sessionPath, new Date(), new Date(1_000_000))
      const second = listSessionsHandler(gated, listRequest)
      await secondRunCalled
      signal.release()
      await Promise.all([first, second])
      return reads
    }

    it('does not share a read between listings that saw different file states', async () => {
      expect(await readsForTwoListings(true)).toBe(2)
    })

    it('still shares a read between listings that saw the same file state', async () => {
      expect(await readsForTwoListings(false)).toBe(1)
    })
  })
})
