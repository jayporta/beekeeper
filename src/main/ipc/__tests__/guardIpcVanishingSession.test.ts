import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { ok } from '../../../core/shared/result'
import { getSession } from '../../../service/sessionDetail/getSession'
import { getWorktreeDiffs } from '../../../service/worktrees/getWorktreeDiffs'
import type { ServiceDeps } from '../../../service/serviceDeps'
import { NO_SCAN_CACHE, TEST_PROJECT, TEST_SESSION_ID } from '../../../service/testServiceTree'
import { guardIpc } from '../guardIpc'
import { registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const gitContext = registerTestGit()

describe('guardIpc around getSession', () => {
  it('returns not-found when the transcript vanishes mid-scan', async () => {
    const vanishing: ServiceDeps['scans'] = {
      run: async (_key, task) => {
        await rm(ctx.tree.sessionPath)
        return task()
      }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: () =>
        getSession(
          { ...ctx.deps, scans: vanishing, scanCache: NO_SCAN_CACHE },
          { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }
        )
    })

    expect(await listener({})).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})

describe('guardIpc around getWorktreeDiffs', () => {
  it('returns internal when the scan rejects', async (context) => {
    const git = gitContext.requireGit(context)
    const deps: ServiceDeps = {
      ...ctx.deps,
      git: () => Promise.resolve(ok(git)),
      scans: { run: () => Promise.reject(new Error('boom')) }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: () =>
        getWorktreeDiffs(deps, { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID })
    })

    expect(await listener({})).toEqual({ ok: false, error: { code: 'internal' } })
  })
})
