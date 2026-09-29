import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GitBinary } from '../gitBinary'
import { hangingFsRunner } from '../testFsRunner'
import { registerTestGit, type TestRepo } from '../testGitRepo'
import { checkWorktree } from '../worktreeSafety'

const testGit = registerTestGit()

async function setUp(binary: GitBinary): Promise<{ repo: TestRepo; worktree: string }> {
  const repo = await testGit.baseRepo(binary)
  const worktree = join(repo.root, 'wt')
  repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
  return { repo, worktree }
}

describe('checkWorktree when a filesystem call hangs', () => {
  it('reports timeout, not no-worktree or safe, when checking the directory hangs', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)

    const result = await checkWorktree({
      git,
      repoDir: repo.dir,
      worktreeDir: worktree,
      agentBranch: 'agent',
      fsRunner: hangingFsRunner({ passes: 0, hangs: 1 })
    })

    expect(result).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports timeout when resolving a common directory hangs', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)

    const result = await checkWorktree({
      git,
      repoDir: repo.dir,
      worktreeDir: worktree,
      agentBranch: 'agent',
      fsRunner: hangingFsRunner({ passes: 1 })
    })

    expect(result).toEqual({ ok: false, error: 'timeout' })
  })

  it('fails closed to worktree-mismatch when resolving the worktree paths hangs', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)

    const result = await checkWorktree({
      git,
      repoDir: repo.dir,
      worktreeDir: worktree,
      agentBranch: 'agent',
      fsRunner: hangingFsRunner({ passes: 3 })
    })

    expect(result).toEqual({ ok: true, value: 'worktree-mismatch' })
  })
})
