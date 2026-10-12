import { describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { ok } from '../../../core/shared/result'
import { encodeProjectDir } from '../confineRepo'
import { addAgentWorktree, projectWorktreesDir } from '../testWorktreeScan'
import { getSession } from '../../sessionDetail/getSession'
import { getWorktreeDiffs } from '../getWorktreeDiffs'
import { countingDeps } from '../testCountingDeps'
import { registerServiceTestTree, TEST_PROJECT, TEST_SESSION_ID } from '../../testServiceTree'
import { registerWorktreeSessions } from '../testWorktreeSession'

const ctx = registerServiceTestTree()
const gitContext = registerTestGit()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

describe('getWorktreeDiffs', () => {
  it('locates no git and scans nothing for an unknown session', async () => {
    const { deps, counts } = countingDeps(ctx.deps)
    const unknown = { ...request, sessionId: '2b2b2b2b-2222-4222-8222-22222222222b' }
    expect(await getWorktreeDiffs(deps, unknown)).toEqual({
      ok: false,
      error: { code: 'not-found' }
    })
    expect(counts).toEqual({ scans: 0, git: 0 })
  })

  it('reports a missing git without scanning', async () => {
    const { deps, counts } = countingDeps(ctx.deps)
    expect(await getWorktreeDiffs(deps, request)).toEqual({
      ok: true,
      value: { git: 'git-not-found', agents: [], sharedWorktree: null }
    })
    expect(counts.scans).toBe(0)
  })

  it('returns no agents for a session without worktree agents', async (context) => {
    const git = gitContext.requireGit(context)
    const deps = { ...ctx.deps, git: () => Promise.resolve(ok(git)) }
    expect(await getWorktreeDiffs(deps, request)).toEqual({
      ok: true,
      value: { git: 'ok', agents: [], sharedWorktree: null }
    })
  })

  it('runs one scan for getSession followed by getWorktreeDiffs', async (context) => {
    const git = gitContext.requireGit(context)
    const { deps: counted, counts } = countingDeps(ctx.deps)
    const deps = { ...counted, git: () => Promise.resolve(ok(git)) }
    await getSession(deps, request)
    await getWorktreeDiffs(deps, request)
    expect(counts.scans).toBe(1)
  })
})

describe('getWorktreeDiffs on a real repository', () => {
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

    const result = await getWorktreeDiffs(deps, sessionRequest)

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
