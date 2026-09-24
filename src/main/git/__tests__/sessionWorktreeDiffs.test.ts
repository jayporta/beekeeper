import { toAgentId } from '../../../core/transcript/ids'
import { describe, expect, it, vi } from 'vitest'
import { resolveBranch } from '../../../core/git/resolveBranch'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { createScanScheduler, type ScanScheduler } from '../../ipc/scanScheduler'
import { encodeProjectDir } from '../confineRepo'
import { sessionWorktreeDiffs } from '../sessionWorktreeDiffs'
import {
  addAgentWorktree,
  projectWorktreesDir,
  registerWorktreeScans,
  withSpawnCwd
} from '../testWorktreeScan'

const gitContext = registerTestGit()
const scans = registerWorktreeScans()
const fixture = scans.fixture

const scheduler = (): ScanScheduler => createScanScheduler({ maxConcurrent: 3 })

describe('sessionWorktreeDiffs', () => {
  it('diffs a present worktree including its uncommitted work', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const path = await addAgentWorktree({ repo, name: 'wt1', parent: projectWorktreesDir(repo) })
    await repo.write({ path: 'loose.txt', content: 'x\n', dir: path })
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt1', worktreePath: path }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: scheduler()
    })

    expect(entry?.agentId).toBe(toAgentId('a'))
    expect(entry?.inferredBase).toBe(false)
    const value = entry?.result.ok ? entry.result.value : undefined
    expect(value?.uncommitted).toBe('included')
    expect(value?.files.map((file) => file.path)).toEqual(['wt1.txt'])
    expect(value?.untracked).toEqual(['loose.txt'])
  })

  it('falls back to the branch alone when the worktree was removed', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const path = await addAgentWorktree({ repo, name: 'wt1', parent: projectWorktreesDir(repo) })
    repo.git(['worktree', 'remove', '--force', path])
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt1', worktreePath: path }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: scheduler()
    })

    const value = entry?.result.ok ? entry.result.value : undefined
    expect(value?.uncommitted).toBe('no-worktree')
    expect(value?.files.map((file) => file.path)).toEqual(['wt1.txt'])
  })

  it('reports branch-not-found when the agent branch was deleted', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'deleted-branch' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: scheduler()
    })

    expect(entry?.result).toEqual({ ok: false, error: 'branch-not-found' })
  })

  it('reports no-base when the spawn had a detached HEAD', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const { scan } = await fixture({
      cwd: repo.dir,
      gitBranch: 'HEAD',
      agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: scheduler()
    })

    expect(entry?.result).toEqual({ ok: false, error: 'no-base' })
  })

  it('refuses a spawn cwd that is in a different repo than the first cwd', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const other = await gitContext.baseRepo(git)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [
        { agentId: 'a', worktreeBranch: 'agent' },
        { agentId: 'b', worktreeBranch: 'agent' }
      ]
    })
    const forged = withSpawnCwd({ scan, agentId: 'b', cwd: other.dir })

    const entries = await sessionWorktreeDiffs({
      git,
      scan: forged,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: scheduler()
    })

    expect(entries.map((entry) => entry.result.ok)).toEqual([true, false])
    expect(entries[1]?.result).toEqual({ ok: false, error: 'outside-project' })
  })

  it('refuses every agent when the first cwd does not encode to the project folder', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: '-some-other-project',
      scheduler: scheduler()
    })

    expect(entry?.result).toEqual({ ok: false, error: 'outside-project' })
  })

  it('resolves a shared base branch once', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    repo.git(['branch', 'agent2'])
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [
        { agentId: 'a', worktreeBranch: 'agent' },
        { agentId: 'b', worktreeBranch: 'agent2' }
      ]
    })
    const resolve = vi.fn(resolveBranch)

    const entries = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: scheduler(),
      resolve
    })

    expect(entries.every((entry) => entry.result.ok)).toBe(true)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('does not share a result between agents whose diff inputs differ', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    await addAgentWorktree({ repo, name: 'wt1' })
    await addAgentWorktree({ repo, name: 'wt2' })
    const first = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt1' }]
    })
    const second = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt2' }]
    })
    const shared = scheduler()
    const run = (scan: typeof first.scan): ReturnType<typeof sessionWorktreeDiffs> =>
      sessionWorktreeDiffs({
        git,
        scan,
        projectDirName: encodeProjectDir(repo.dir),
        scheduler: shared
      })

    const [[one], [two]] = await Promise.all([run(first.scan), run(second.scan)])

    const paths = (entry: typeof one): string[] | undefined =>
      entry?.result.ok ? entry.result.value.files.map((file) => file.path) : undefined
    expect(paths(one)).toEqual(['wt1.txt'])
    expect(paths(two)).toEqual(['wt2.txt'])
  })
})
