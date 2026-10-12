import { describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { ok } from '../../../core/shared/result'
import { getWorktreeDiffs } from '../../../service/worktrees/getWorktreeDiffs'
import type { ServiceDeps } from '../../../service/serviceDeps'
import { TEST_PROJECT, TEST_SESSION_ID } from '../../../service/testServiceTree'
import { guardIpc } from '../guardIpc'
import { registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const gitContext = registerTestGit()

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
