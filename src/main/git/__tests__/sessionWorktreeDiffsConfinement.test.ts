import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { GitBinary } from '../../../core/git/gitBinary'
import { registerTestGit, type TestRepo } from '../../../core/git/testGitRepo'
import { createScanScheduler, type ScanScheduler } from '../../ipc/scanScheduler'
import { encodeProjectDir } from '../confineRepo'
import { sessionWorktreeDiffs } from '../sessionWorktreeDiffs'
import { registerGitSpies } from '../testGitSpy'
import {
  addAgentWorktree,
  projectWorktreesDir,
  registerWorktreeScans,
  withSpawnCwd
} from '../testWorktreeScan'

const gitContext = registerTestGit()
const scans = registerWorktreeScans()
const fixture = scans.fixture
const spies = registerGitSpies()
const cleanupDirs: string[] = []

afterEach(async () => {
  await Promise.all(cleanupDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('sessionWorktreeDiffs confinement', () => {
  it('accepts a spawn cwd inside a linked worktree of the project', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const parent = await addAgentWorktree({
      repo,
      name: 'parent',
      parent: projectWorktreesDir(repo)
    })
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan: withSpawnCwd({ scan, agentId: 'a', cwd: parent }),
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    expect(entry?.result.ok).toBe(true)
  })

  it('refuses a separate repo nested inside the project', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const nested = join(repo.dir, 'vendor', 'nested')
    await mkdir(nested, { recursive: true })
    repo.git(['init', '--quiet'], nested)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan: withSpawnCwd({ scan, agentId: 'a', cwd: nested }),
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    expect(entry?.result).toEqual({ ok: false, error: 'outside-project' })
  })

  it('refuses a spawn cwd outside the top-level without touching it', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan: withSpawnCwd({ scan, agentId: 'a', cwd: join(repo.root, 'never-created') }),
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    // A directory that doesn't exist would report `repo-missing` if it were ever probed.
    expect(entry?.result).toEqual({ ok: false, error: 'outside-project' })
  })

  it('gives a branch-only diff when the worktree path is outside the project', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const outside = await addAgentWorktree({ repo, name: 'wt1' })
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt1', worktreePath: outside }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    const value = entry?.result.ok ? entry.result.value : undefined
    expect(value?.uncommitted).toBe('no-worktree')
    expect(value?.files.map((file) => file.path)).toEqual(['wt1.txt'])
  })

  it('runs every git call inside a scheduled task', async (context) => {
    const real = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(real)
    const spy = spies.create(real)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [
        { agentId: 'a', worktreeBranch: 'agent' },
        { agentId: 'b', worktreeBranch: 'agent' }
      ]
    })
    const inner = createScanScheduler({ maxConcurrent: 3 })
    const scheduler: ScanScheduler = {
      run: (key, task) =>
        inner.run(key, async () => {
          spy.mark('enter')
          try {
            return await task()
          } finally {
            spy.mark('exit')
          }
        })
    }

    await sessionWorktreeDiffs({
      git: spy.git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler
    })

    let depth = 0
    const unscheduled = spy.events().filter((event) => {
      if (event === 'enter') depth += 1
      else if (event === 'exit') depth -= 1
      else return depth === 0
      return false
    })
    expect(spy.events().some((event) => event.startsWith('git '))).toBe(true)
    expect(unscheduled).toEqual([])
  })

  it('runs no git for a session with no worktree agents', async (context) => {
    const real = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(real)
    const spy = spies.create(real)
    const { scan } = await fixture({ cwd: repo.dir, agents: [] })

    const entries = await sessionWorktreeDiffs({
      git: spy.git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    expect(entries).toEqual([])
    expect(spy.events()).toEqual([])
  })

  it('runs no git when every agent lacks a base', async (context) => {
    const real = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(real)
    const spy = spies.create(real)
    const { scan } = await fixture({
      cwd: repo.dir,
      gitBranch: 'HEAD',
      agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git: spy.git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    // Lets a git call that was started but not awaited reach the log.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(entry?.result).toEqual({ ok: false, error: 'no-base' })
    expect(spy.events()).toEqual([])
  })

  describe('a first cwd reached through a symlink below the top-level', () => {
    async function linkedProject(
      git: GitBinary
    ): Promise<{ repo: TestRepo; linkRoot: string; cwd: string }> {
      const repo = await gitContext.baseRepo(git)
      await mkdir(join(repo.dir, 'packages', 'app', 'sub'), { recursive: true })
      const linkRoot = await mkdtemp(join(tmpdir(), 'beekeeper-link-'))
      cleanupDirs.push(linkRoot)
      await symlink(join(repo.dir, 'packages'), join(linkRoot, 'packages'))
      await mkdir(join(linkRoot, 'other'))
      return { repo, linkRoot, cwd: join(linkRoot, 'packages', 'app') }
    }

    it('accepts spawn cwds equal to or below the first cwd', async (context) => {
      const git = gitContext.requireGit(context)
      const { cwd } = await linkedProject(git)
      const { scan } = await fixture({
        cwd,
        agents: [
          { agentId: 'a', worktreeBranch: 'agent' },
          { agentId: 'b', worktreeBranch: 'agent' }
        ]
      })

      const entries = await sessionWorktreeDiffs({
        git,
        scan: withSpawnCwd({ scan, agentId: 'b', cwd: join(cwd, 'sub') }),
        projectDirName: encodeProjectDir(cwd),
        scheduler: createScanScheduler({ maxConcurrent: 3 })
      })

      expect(entries.map((entry) => entry.result.ok)).toEqual([true, true])
    })

    it('refuses a sibling under the link root without running git there', async (context) => {
      const real = gitContext.requireGit(context)
      const { linkRoot, cwd } = await linkedProject(real)
      const spy = spies.create(real)
      const other = join(linkRoot, 'other')
      const { scan } = await fixture({
        cwd,
        agents: [{ agentId: 'a', worktreeBranch: 'agent' }]
      })

      const [entry] = await sessionWorktreeDiffs({
        git: spy.git,
        scan: withSpawnCwd({ scan, agentId: 'a', cwd: other }),
        projectDirName: encodeProjectDir(cwd),
        scheduler: createScanScheduler({ maxConcurrent: 3 })
      })

      expect(entry?.result).toEqual({ ok: false, error: 'outside-project' })
      expect(spy.events().filter((event) => event.includes(other))).toEqual([])
    })
  })

  it('reports a git failure on the worktree check instead of dropping the worktree', async (context) => {
    const real = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(real)
    const path = await addAgentWorktree({ repo, name: 'wt1', parent: projectWorktreesDir(repo) })
    const spy = spies.create(real, {
      failOn: `-C ${await realpath(path)} rev-parse --path-format=absolute --git-common-dir`
    })
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'wt1', worktreePath: path }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git: spy.git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    expect(entry?.result).toEqual({ ok: false, error: 'spawn-failed' })
  })

  it('gives a branch-only diff when the worktree path is a nested repo', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const nested = join(projectWorktreesDir(repo), 'nested')
    await mkdir(nested, { recursive: true })
    repo.git(['init', '--quiet'], nested)
    const { scan } = await fixture({
      cwd: repo.dir,
      agents: [{ agentId: 'a', worktreeBranch: 'agent', worktreePath: nested }]
    })

    const [entry] = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler: createScanScheduler({ maxConcurrent: 3 })
    })

    const value = entry?.result.ok ? entry.result.value : undefined
    expect(value?.uncommitted).toBe('no-worktree')
  })
})
