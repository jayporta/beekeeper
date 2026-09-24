import { writeFile } from 'node:fs/promises'
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
})
