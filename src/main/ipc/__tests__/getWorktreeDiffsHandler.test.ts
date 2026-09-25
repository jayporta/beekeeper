import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { buildJsonlText } from '../../../core/transcript/testFixtures'
import { buildSpawnRecord } from '../../../core/session/testSpawnFixtures'
import { err, ok } from '../../../core/transcript/result'
import { encodeProjectDir } from '../../git/confineRepo'
import { addAgentWorktree, projectWorktreesDir } from '../../git/testWorktreeScan'
import { createIpcDeps } from '../createIpcDeps'
import { getSessionHandler } from '../getSessionHandler'
import { getWorktreeDiffsHandler } from '../getWorktreeDiffsHandler'
import { guardIpc } from '../guardIpc'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

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
      value: { git: 'git-not-found', agents: [] }
    })
    expect(counts.scans).toBe(0)
  })

  it('returns no agents for a session without worktree agents', async (context) => {
    const git = gitContext.requireGit(context)
    const deps = { ...ctx.deps, git: () => Promise.resolve(ok(git)) }
    expect(await getWorktreeDiffsHandler(deps, request)).toEqual({
      ok: true,
      value: { git: 'ok', agents: [] }
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
  let home: string | undefined

  afterEach(async () => {
    if (home !== undefined) await rm(home, { recursive: true, force: true })
    home = undefined
  })

  it('diffs a worktree agent whose spawn repo is the project folder', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const path = await addAgentWorktree({ repo, name: 'wt1', parent: projectWorktreesDir(repo) })
    const projectDirName = encodeProjectDir(repo.dir)
    home = await mkdtemp(join(tmpdir(), 'beekeeper-diffs-'))
    const sessionDir = join(home, '.claude', 'projects', projectDirName)
    const subagents = join(sessionDir, TEST_SESSION_ID, 'subagents')
    await mkdir(subagents, { recursive: true })
    await writeFile(
      join(sessionDir, `${TEST_SESSION_ID}.jsonl`),
      buildJsonlText([buildSpawnRecord({ toolUseIds: ['toolu_a'], cwd: repo.dir })])
    )
    await writeFile(join(subagents, 'agent-a.jsonl'), buildJsonlText([]))
    await writeFile(
      join(subagents, 'agent-a.meta.json'),
      JSON.stringify({
        agentType: 'x',
        toolUseId: 'toolu_a',
        worktreeBranch: 'wt1',
        worktreePath: path
      })
    )
    const deps = { ...createIpcDeps(home), git: () => Promise.resolve(ok(git)) }

    const result = await getWorktreeDiffsHandler(deps, {
      projectDirName,
      sessionId: TEST_SESSION_ID
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        git: 'ok',
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
