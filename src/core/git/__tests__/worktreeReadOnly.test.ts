import { readFile, stat, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GitBinary } from '../gitBinary'
import { registerTestGit, type TestRepo } from '../testGitRepo'
import { worktreeDiffStat } from '../worktreeDiffStat'

const testGit = registerTestGit()

interface StaleWorktree {
  readonly repo: TestRepo
  readonly worktree: string
  readonly indexPath: string
}

/**
 * A worktree whose index has stale stat data: `keep.txt` is touched without
 * changing its content, and `old-name.txt` really changes.
 */
async function setUpStale(git: GitBinary): Promise<StaleWorktree> {
  const repo = await testGit.baseRepo(git)
  const worktree = join(repo.root, 'wt')
  repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
  const future = new Date(Date.now() + 60_000)
  await utimes(join(worktree, 'keep.txt'), future, future)
  await repo.write({ path: 'old-name.txt', content: 'a\nb\nc\nd\ne\nX\n', dir: worktree })
  const indexPath = join(repo.git(['rev-parse', '--absolute-git-dir'], worktree), 'index')
  return { repo, worktree, indexPath }
}

function diff(
  git: GitBinary,
  { repo, worktree }: StaleWorktree
): ReturnType<typeof worktreeDiffStat> {
  return worktreeDiffStat({
    git,
    repoDir: repo.dir,
    baseSha: repo.sha('main'),
    agentBranch: 'agent',
    worktreeDir: worktree
  })
}

describe.skipIf(process.platform === 'win32')('working-tree diff is read-only', () => {
  it('leaves the index bytes and mtime unchanged when its stat data is stale', async (context) => {
    const git = testGit.requireGit(context)
    const stale = await setUpStale(git)
    const before = {
      bytes: await readFile(stale.indexPath),
      mtime: (await stat(stale.indexPath)).mtimeMs
    }

    await diff(git, stale)

    const after = {
      bytes: await readFile(stale.indexPath),
      mtime: (await stat(stale.indexPath)).mtimeMs
    }
    expect(after.bytes.equals(before.bytes)).toBe(true)
    expect(after.mtime).toBe(before.mtime)
  })

  it('lists only files whose content changed, not files that are merely stat-dirty', async (context) => {
    const git = testGit.requireGit(context)
    const stale = await setUpStale(git)

    const result = await diff(git, stale)

    expect(result).toEqual({
      ok: true,
      value: {
        files: [{ path: 'old-name.txt', added: 1, deleted: 1 }],
        untracked: [],
        uncommitted: 'included'
      }
    })
  })
})
