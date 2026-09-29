import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GitBinary } from '../gitBinary'
import { GIT_ENV } from '../gitEnv'
import { runGit } from '../runGit'
import { registerTestGit, type TestRepo } from '../testGitRepo'
import { worktreeDiffStat, type WorktreeDiffStatOptions } from '../worktreeDiffStat'

const testGit = registerTestGit()

/** Runs the diff with `main`'s tip as the base and `agent` as the branch. */
function diffStat(
  git: GitBinary,
  repo: TestRepo,
  extra: Partial<WorktreeDiffStatOptions> = {}
): ReturnType<typeof worktreeDiffStat> {
  return worktreeDiffStat({
    git,
    repoDir: repo.dir,
    baseSha: repo.sha('main'),
    agentBranch: 'agent',
    ...extra
  })
}

/**
 * Commits a file whose path holds the byte 0xFF, which no UTF-8 name can. The
 * path goes straight into the index, so the host filesystem never sees it.
 */
async function commitInvalidUtf8Path(git: GitBinary, repo: TestRepo): Promise<void> {
  await repo.write({ path: 'blob.txt', content: 'hi\n' })
  const blob = repo.git(['hash-object', '-w', 'blob.txt'])
  execFileSync(git, ['update-index', '--index-info'], {
    cwd: repo.dir,
    env: { ...GIT_ENV },
    input: Buffer.concat([
      Buffer.from(`100644 ${blob}\t`),
      Buffer.from([0xff]),
      Buffer.from('bad.txt\n')
    ])
  })
  repo.git(['commit', '--quiet', '-m', 'invalid path'])
}

describe('worktreeDiffStat', () => {
  it('diffs a committed agent branch from its merge base', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    repo.git(['checkout', '--quiet', 'agent'])
    await repo.write({ path: 'keep.txt', content: 'one\ntwo\nthree\n' })
    await repo.write({ path: 'added.txt', content: 'x\n' })
    repo.git(['add', '-A'])
    repo.git(['commit', '--quiet', '-m', 'agent work'])
    repo.git(['checkout', '--quiet', 'main'])
    await repo.write({ path: 'main-only.txt', content: 'later\n' })
    repo.git(['add', '-A'])
    repo.git(['commit', '--quiet', '-m', 'main moves on'])

    const result = await diffStat(gitBinary, repo)

    expect(result).toEqual({
      ok: true,
      value: {
        files: [
          { path: 'added.txt', added: 1, deleted: 0 },
          { path: 'keep.txt', added: 1, deleted: 0 }
        ],
        untracked: [],
        uncommitted: 'no-worktree'
      }
    })
  })

  it('includes uncommitted and untracked work when a worktree exists', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    const worktree = join(repo.root, 'wt')
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
    await repo.write({ path: 'keep.txt', content: 'one\n', dir: worktree })
    await repo.write({ path: 'new dir/untracked\tfile.txt', content: 'u\n', dir: worktree })
    await repo.write({ path: 'image.bin', content: Buffer.from([0, 1, 2, 0, 255]), dir: worktree })
    repo.git(['add', 'image.bin'], worktree)

    const result = await diffStat(gitBinary, repo, { worktreeDir: worktree })

    expect(result).toEqual({
      ok: true,
      value: {
        files: [
          { path: 'image.bin', added: null, deleted: null },
          { path: 'keep.txt', added: 0, deleted: 1 }
        ],
        untracked: ['new dir/'],
        uncommitted: 'included'
      }
    })
  })

  it('reports a rename with both paths', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    repo.git(['checkout', '--quiet', 'agent'])
    repo.git(['mv', 'old-name.txt', 'new-name.txt'])
    repo.git(['commit', '--quiet', '-m', 'rename'])

    const result = await diffStat(gitBinary, repo)

    expect(result).toEqual({
      ok: true,
      value: {
        files: [{ path: 'new-name.txt', oldPath: 'old-name.txt', added: 0, deleted: 0 }],
        untracked: [],
        uncommitted: 'no-worktree'
      }
    })
  })

  it('returns branch-not-found for a deleted agent branch', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    repo.git(['branch', '-D', 'agent'])

    const result = await diffStat(gitBinary, repo)

    expect(result).toEqual({ ok: false, error: 'branch-not-found' })
  })

  it('returns no-common-ancestor for unrelated histories', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    repo.git(['checkout', '--quiet', '--orphan', 'unrelated'])
    await repo.write({ path: 'other.txt', content: 'x\n' })
    repo.git(['add', 'other.txt'])
    repo.git(['commit', '--quiet', '-m', 'orphan'])

    const result = await diffStat(gitBinary, repo, { agentBranch: 'unrelated' })

    expect(result).toEqual({ ok: false, error: 'no-common-ancestor' })
  })

  it('includes uncommitted work in a path holding a literal U+FFFD', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    const worktree = join(repo.root, 'wt')
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
    await repo.write({ path: 'bad\uFFFD.txt', content: 'v1\n', dir: worktree })
    repo.git(['add', '-A'], worktree)
    repo.git(['commit', '--quiet', '-m', 'replacement char'], worktree)
    await repo.write({ path: 'bad\uFFFD.txt', content: 'v2\nmore\n', dir: worktree })

    const result = await diffStat(gitBinary, repo, { worktreeDir: worktree })

    expect(result).toEqual({
      ok: true,
      value: {
        files: [{ path: 'bad\uFFFD.txt', added: 2, deleted: 0 }],
        untracked: [],
        uncommitted: 'included'
      }
    })
  })

  it('falls back to the committed diff when a changed path is not valid UTF-8', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)
    await commitInvalidUtf8Path(gitBinary, repo)
    repo.git(['branch', '--force', 'agent', 'main'])
    const worktree = join(repo.root, 'wt')
    // Without a checkout, the working tree lacks every file, so the diff lists the invalid path as deleted.
    repo.git(['worktree', 'add', '--quiet', '--no-checkout', worktree, 'agent'])
    repo.git(['reset', '--quiet'], worktree)

    const result = await diffStat(gitBinary, repo, { worktreeDir: worktree })

    expect(result).toEqual({
      ok: true,
      value: { files: [], untracked: [], uncommitted: 'skipped-filters' }
    })
  })

  it('refuses to run an unlisted subcommand against a real repo', async (context) => {
    const gitBinary = testGit.requireGit(context)
    const repo = await testGit.baseRepo(gitBinary)

    await expect(runGit({ git: gitBinary, dir: repo.dir, args: ['status'] })).rejects.toThrow(
      'git-subcommand-not-allowed'
    )
  })
})
