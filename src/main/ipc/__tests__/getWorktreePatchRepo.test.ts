import { mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, type TestContext } from 'vitest'
import { PATCH_ARGS } from '../../../core/git/gitAllowlist'
import { MAX_FILE_PATCH_BYTES, MAX_TOTAL_PATCH_BYTES } from '../../../core/git/capPatches'
import { registerTestGit, type TestRepo } from '../../../core/git/testGitRepo'
import { encodeProjectDir } from '../../git/confineRepo'
import { registerGitSpies } from '../../../core/git/testGitSpy'
import { addAgentWorktree, projectWorktreesDir } from '../../git/testWorktreeScan'
import { getWorktreeDiffsHandler } from '../getWorktreeDiffsHandler'
import { getWorktreePatchHandler } from '../getWorktreePatchHandler'
import { registerWorktreeSessions, type WorktreeSession } from '../testWorktreeSession'
import type { GitBinary } from '../../../core/git/gitBinary'
import type { WorktreePatchDto } from '../../../shared/ipc/worktreePatchDto'

const gitContext = registerTestGit()
const sessions = registerWorktreeSessions()
const spies = registerGitSpies()

interface Scene {
  readonly repo: TestRepo
  readonly worktree: string
  readonly session: WorktreeSession
  readonly events: () => string[]
}

/** A project repo with a worktree agent `wt1` on a branch, spawned from the project's folder. */
async function scene(
  context: TestContext,
  extra: { spawnCwd?: string; worktreePath?: string; extraAgents?: boolean } = {}
): Promise<Scene> {
  const real = gitContext.requireGit(context)
  const repo = await gitContext.baseRepo(real)
  const worktree = await addAgentWorktree({ repo, name: 'wt1', parent: projectWorktreesDir(repo) })
  const spy = spies.create(real)
  const session = await sessions.create({
    projectDirName: encodeProjectDir(repo.dir),
    cwd: repo.dir,
    git: spy.git as GitBinary,
    agents: [
      {
        agentId: 'a',
        worktreeBranch: 'wt1',
        worktreePath: extra.worktreePath ?? worktree,
        ...(extra.spawnCwd === undefined ? {} : { spawnCwd: extra.spawnCwd })
      },
      { agentId: 'plain' }
    ]
  })
  return { repo, worktree, session, events: spy.events }
}

async function patchOf(
  session: WorktreeSession,
  agentId: string
): ReturnType<typeof getWorktreePatchHandler> {
  return getWorktreePatchHandler(session.deps, { ...session.request, agentId })
}

function ready(
  result: Awaited<ReturnType<typeof getWorktreePatchHandler>>
): Extract<WorktreePatchDto, { kind: 'ready' }> {
  if (!result.ok || result.value.kind !== 'ready') throw new Error('expected a ready patch')
  return result.value
}

describe('getWorktreePatchHandler on a real repository', () => {
  it('returns the patch of a worktree agent, uncommitted edits included', async (context) => {
    const { repo, worktree, session } = await scene(context)
    await repo.write({ path: 'wt1.txt', content: 'edited\n', dir: worktree })

    const value = ready(await patchOf(session, 'a'))

    expect(value.uncommitted).toBe('included')
    expect(value.truncatedTotal).toBe(false)
    expect(value.files).toHaveLength(1)
    expect(value.files[0]).toMatchObject({ path: 'wt1.txt', truncated: false })
    expect(value.files[0]?.patch).toContain('+edited\n')
  })

  it('crosses the bridge as plain text, with only the whitelisted fields', async (context) => {
    const { repo, worktree, session } = await scene(context)
    await repo.write({ path: 'wt1.txt', content: '<script>alert(1)</script>\n', dir: worktree })

    const value = ready(await patchOf(session, 'a'))

    expect(Object.keys(value).sort()).toEqual(['files', 'kind', 'truncatedTotal', 'uncommitted'])
    expect(Object.keys(value.files[0] ?? {}).sort()).toEqual(['patch', 'path', 'truncated'])
    expect(value.files[0]?.patch).toContain('+<script>alert(1)</script>\n')
  })

  it('runs one diff-index over the whole range with the fixed flags and no path', async (context) => {
    const { repo, worktree, session, events } = await scene(context)
    await repo.write({ path: 'wt1.txt', content: 'edited\n', dir: worktree })

    await patchOf(session, 'a')

    const lines = events().filter((line) => line.includes(' diff-index '))
    const patchLine = lines.at(-1)
    expect(patchLine).toContain(
      `-C ${await realpath(worktree)} diff-index ${PATCH_ARGS.join(' ')} `
    )
    expect(patchLine?.endsWith(` ${repo.git(['merge-base', 'main', 'wt1'])} --`)).toBe(true)
  })

  it('runs no git for an agent that is not in the session', async (context) => {
    const { session, events } = await scene(context)

    const result = await patchOf(session, 'not-an-agent')

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(events().filter((line) => / diff(-index)? /.test(line))).toEqual([])
  })

  it('refuses an agent whose meta names no worktree branch, running no git', async (context) => {
    const { session, events } = await scene(context)

    const result = await patchOf(session, 'plain')

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(events().filter((line) => / diff(-index)? /.test(line))).toEqual([])
  })

  it('refuses a spawn repository outside the project, running no diff', async (context) => {
    const real = gitContext.requireGit(context)
    const elsewhere = await gitContext.baseRepo(real)
    const { session, events } = await scene(context, { spawnCwd: elsewhere.dir })

    const result = await patchOf(session, 'a')

    expect(result).toEqual({ ok: true, value: { kind: 'failed', code: 'outside-project' } })
    expect(events().filter((line) => / diff(-index)? /.test(line))).toEqual([])
  })

  it('ignores a worktree path outside the project, reading committed work only', async (context) => {
    const outside = await mkdtemp(join(tmpdir(), 'beekeeper-outside-'))
    const { session } = await scene(context, { worktreePath: outside })

    const value = ready(await patchOf(session, 'a'))

    expect(value.uncommitted).toBe('no-worktree')
    expect(value.files.map((file) => file.path)).toEqual(['wt1.txt'])
  })

  it('reports a deleted agent branch as a failure code', async (context) => {
    const { repo, session } = await scene(context)
    repo.git(['worktree', 'remove', '--force', join(projectWorktreesDir(repo), 'wt1')])
    repo.git(['branch', '-D', 'wt1'])

    expect(await patchOf(session, 'a')).toEqual({
      ok: true,
      value: { kind: 'failed', code: 'branch-not-found' }
    })
  })

  it('cuts one file’s patch at the per-file cap and marks it', async (context) => {
    const { repo, worktree, session } = await scene(context)
    const big = `${'a line of repeated text\n'.repeat(20_000)}`
    await repo.write({ path: 'big.txt', content: big, dir: worktree })
    repo.git(['add', 'big.txt'], worktree)

    const value = ready(await patchOf(session, 'a'))

    const file = value.files.find((entry) => entry.path === 'big.txt')
    expect(file?.truncated).toBe(true)
    expect(Buffer.byteLength(file?.patch ?? '')).toBeLessThanOrEqual(MAX_FILE_PATCH_BYTES)
    expect(file?.patch.endsWith('\n')).toBe(true)
    expect(value.truncatedTotal).toBe(false)
  })

  it('cuts at the total cap, leaves later files with no patch, and marks the whole', async (context) => {
    const { repo, worktree, session } = await scene(context)
    const chunk = `${'x'.repeat(79)}\n`.repeat(2_300)
    for (let i = 0; i < 14; i += 1) {
      await repo.write({
        path: `f${String(i).padStart(2, '0')}.txt`,
        content: chunk,
        dir: worktree
      })
    }
    repo.git(['add', '-A'], worktree)

    const value = ready(await patchOf(session, 'a'))

    const total = value.files.reduce((sum, file) => sum + Buffer.byteLength(file.patch), 0)
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_PATCH_BYTES)
    expect(value.truncatedTotal).toBe(true)
    expect(value.files.at(-1)).toMatchObject({ patch: '', truncated: true })
    expect(value.files.filter((file) => file.truncated).length).toBeGreaterThan(1)
  })

  it('does not share a task with the numstat of the same agent', async (context) => {
    const { repo, worktree, session } = await scene(context)
    await repo.write({ path: 'wt1.txt', content: 'edited\n', dir: worktree })

    const [patch, diffs] = await Promise.all([
      patchOf(session, 'a'),
      getWorktreeDiffsHandler(session.deps, session.request)
    ])

    expect(ready(patch).files).toHaveLength(1)
    expect(diffs.ok && diffs.value.agents[0]?.result).toMatchObject({
      ok: true,
      diff: { files: [{ path: 'wt1.txt' }] }
    })
  })
})
