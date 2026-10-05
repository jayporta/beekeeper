import { describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { err, ok } from '../../../core/shared/result'
import { encodeProjectDir } from '../../git/confineRepo'
import { addAgentWorktree, projectWorktreesDir } from '../../git/testWorktreeScan'
import { getSessionHandler } from '../getSessionHandler'
import { getWorktreeDiffsHandler } from '../getWorktreeDiffsHandler'
import { guardIpc } from '../guardIpc'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'
import { registerWorktreeSessions } from '../testWorktreeSession'

const ctx = registerIpcTestTree()
const gitContext = registerTestGit()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

/** Counts scans and git lookups. */
function countingDeps(base: IpcDeps): { deps: IpcDeps; counts: { scans: number; git: number } } {
  const counts = { scans: 0, git: 0 }
  const deps: IpcDeps = {
    ...base,
    scans: {
      run: (key, task) => {
        counts.scans += 1
        return base.scans.run(key, task)
      }
    },
    git: () => {
      counts.git += 1
      return Promise.resolve(err('git-not-found'))
    }
  }
  return { deps, counts }
}

describe('getWorktreeDiffsHandler', () => {
  it.each([
    ['an invalid payload', { projectDirName: '..', sessionId: TEST_SESSION_ID }, 'invalid-request'],
    [
      'an unknown session',
      { ...request, sessionId: '2b2b2b2b-2222-4222-8222-22222222222b' },
      'not-found'
    ]
  ])('locates no git and scans nothing for %s', async (_label, payload, code) => {
    const { deps, counts } = countingDeps(ctx.deps)
    expect(await getWorktreeDiffsHandler(deps, payload)).toEqual({ ok: false, error: { code } })
    expect(counts).toEqual({ scans: 0, git: 0 })
  })

  it('reports a missing git without scanning', async () => {
    const { deps, counts } = countingDeps(ctx.deps)
    expect(await getWorktreeDiffsHandler(deps, request)).toEqual({
      ok: true,
      value: { git: 'git-not-found', agents: [], sharedWorktree: null }
    })
    expect(counts.scans).toBe(0)
  })

  it('returns no agents for a session without worktree agents', async (context) => {
    const git = gitContext.requireGit(context)
    const deps = { ...ctx.deps, git: () => Promise.resolve(ok(git)) }
    expect(await getWorktreeDiffsHandler(deps, request)).toEqual({
      ok: true,
      value: { git: 'ok', agents: [], sharedWorktree: null }
    })
  })

  it('runs one scan for getSession followed by getWorktreeDiffs', async (context) => {
    const git = gitContext.requireGit(context)
    const { deps: counted, counts } = countingDeps(ctx.deps)
    const deps = { ...counted, git: () => Promise.resolve(ok(git)) }
    await getSessionHandler(deps, request)
    await getWorktreeDiffsHandler(deps, request)
    expect(counts.scans).toBe(1)
  })

  it('returns internal through guardIpc when the scan rejects', async (context) => {
    const git = gitContext.requireGit(context)
    const deps: IpcDeps = {
      ...ctx.deps,
      git: () => Promise.resolve(ok(git)),
      scans: { run: () => Promise.reject(new Error('boom')) }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: (payload) => getWorktreeDiffsHandler(deps, payload)
    })
    expect(await listener({}, request)).toEqual({ ok: false, error: { code: 'internal' } })
  })
})

describe('getWorktreeDiffsHandler on a real repository', () => {
  const sessions = registerWorktreeSessions()

  it('diffs a worktree agent whose spawn repo is the project folder', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const path = await addAgentWorktree({ repo, name: 'wt1', parent: projectWorktreesDir(repo) })
    const { deps, request: sessionRequest } = await sessions.create({
      projectDirName: encodeProjectDir(repo.dir),
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt1', worktreePath: path }],
      git
    })

    const result = await getWorktreeDiffsHandler(deps, sessionRequest)

    expect(result).toMatchObject({
      ok: true,
      value: {
        git: 'ok',
        sharedWorktree: null,
        agents: [
          {
            agentId: 'a',
            result: { ok: true, diff: { uncommitted: 'included', files: [{ path: 'wt1.txt' }] } }
          }
        ]
      }
    })
  })
})
