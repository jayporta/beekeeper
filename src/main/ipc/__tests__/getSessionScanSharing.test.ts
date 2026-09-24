import { chmod, utimes } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getSessionHandler } from '../getSessionHandler'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

describe('getSessionHandler scan sharing', () => {
  /** Records the keys the handler asks the scheduler to run. */
  function recordKeys(keys: string[]): IpcDeps['scans'] {
    return {
      run: (key, task) => {
        keys.push(key)
        return task()
      }
    }
  }

  it('uses the same scan key for the same transcript state', async () => {
    const keys: string[] = []
    const deps = { projectsRoot: ctx.deps.projectsRoot, scans: recordKeys(keys) }
    await getSessionHandler(deps, request)
    await getSessionHandler(deps, request)
    expect(keys[0]).toBe(keys[1])
  })

  it('uses a different scan key once the transcript mtime changes', async () => {
    const keys: string[] = []
    const deps = { projectsRoot: ctx.deps.projectsRoot, scans: recordKeys(keys) }
    await getSessionHandler(deps, request)
    await utimes(ctx.tree.sessionPath, new Date(), new Date(1_000_000))
    await getSessionHandler(deps, request)
    expect(keys[0]).not.toBe(keys[1])
  })

  it('uses a different scan key once the subagents folder becomes unreadable', async () => {
    const keys: string[] = []
    const deps = { projectsRoot: ctx.deps.projectsRoot, scans: recordKeys(keys) }
    const subagentsDir = join(dirname(ctx.tree.sessionPath), TEST_SESSION_ID, 'subagents')
    await getSessionHandler(deps, request)
    await chmod(subagentsDir, 0o000)
    try {
      await getSessionHandler(deps, request)
    } finally {
      await chmod(subagentsDir, 0o755)
    }
    expect(keys[0]).not.toBe(keys[1])
  })
})
