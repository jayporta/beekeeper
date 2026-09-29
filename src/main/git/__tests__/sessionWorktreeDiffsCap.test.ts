import { describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { toAgentId } from '../../../core/transcript/ids'
import { createScanScheduler, type ScanScheduler } from '../../ipc/scanScheduler'
import { encodeProjectDir } from '../confineRepo'
import { MAX_WORKTREE_AGENTS_PER_REQUEST, sessionWorktreeDiffs } from '../sessionWorktreeDiffs'
import { registerWorktreeScans } from '../testWorktreeScan'

const gitContext = registerTestGit()
const scans = registerWorktreeScans()

/** A scheduler that counts the tasks handed to it. */
function countingScheduler(): ScanScheduler & { readonly count: () => number } {
  const inner = createScanScheduler({ maxConcurrent: 3 })
  let scheduled = 0
  return {
    run(key, task) {
      scheduled += 1
      return inner.run(key, task)
    },
    count: () => scheduled
  }
}

/** Agent ids that sort in creation order, so tree order is the order they are built in. */
function agentIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `a${String(index).padStart(3, '0')}`)
}

describe('sessionWorktreeDiffs agent cap', () => {
  it('schedules the first agents up to the cap and lists the rest as too-many-agents, in tree order', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const ids = agentIds(MAX_WORKTREE_AGENTS_PER_REQUEST + 2)
    const { scan } = await scans.fixture({
      cwd: repo.dir,
      agents: ids.map((agentId) => ({ agentId, worktreeBranch: 'agent' }))
    })
    const scheduler = countingScheduler()

    const entries = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler
    })

    expect(entries.map((entry) => entry.agentId)).toEqual(ids.map(toAgentId))
    expect(entries.slice(0, MAX_WORKTREE_AGENTS_PER_REQUEST).every((e) => e.result.ok)).toBe(true)
    expect(entries.slice(MAX_WORKTREE_AGENTS_PER_REQUEST).map((e) => e.result)).toEqual([
      { ok: false, error: 'too-many-agents' },
      { ok: false, error: 'too-many-agents' }
    ])
    expect(scheduler.count()).toBe(MAX_WORKTREE_AGENTS_PER_REQUEST)
  })

  it('refuses no agent at exactly the cap', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const { scan } = await scans.fixture({
      cwd: repo.dir,
      agents: agentIds(MAX_WORKTREE_AGENTS_PER_REQUEST).map((agentId) => ({
        agentId,
        worktreeBranch: 'agent'
      }))
    })
    const scheduler = countingScheduler()

    const entries = await sessionWorktreeDiffs({
      git,
      scan,
      projectDirName: encodeProjectDir(repo.dir),
      scheduler
    })

    expect(entries).toHaveLength(MAX_WORKTREE_AGENTS_PER_REQUEST)
    expect(entries.every((entry) => entry.result.ok)).toBe(true)
    expect(scheduler.count()).toBe(MAX_WORKTREE_AGENTS_PER_REQUEST)
  })
})
