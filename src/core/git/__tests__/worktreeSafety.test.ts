import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CommitSha } from '../commitSha'
import { toGitBinary, type GitBinary } from '../gitBinary'
import { registerTestGit, type TestRepo } from '../testGitRepo'
import { worktreeDiffStat } from '../worktreeDiffStat'
import { checkWorktree } from '../worktreeSafety'

const testGit = registerTestGit()

async function setUp(binary: GitBinary): Promise<{ repo: TestRepo; worktree: string }> {
  const repo = await testGit.baseRepo(binary)
  const worktree = join(repo.root, 'wt')
  repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
  return { repo, worktree }
}

describe.skipIf(process.platform === 'win32')('worktree safety', () => {
  it('does not run a planted clean filter and falls back to the committed diff', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)
    const marker = join(repo.root, 'filter-ran')
    repo.git(['config', 'filter.evil.clean', `touch ${marker} && cat`])
    await repo.write({ path: '.gitattributes', content: '* filter=evil\n', dir: worktree })
    await repo.write({ path: 'keep.txt', content: 'ONE\ntwo\n', dir: worktree })

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: repo.sha('main'),
      agentBranch: 'agent',
      worktreeDir: worktree
    })

    expect(result).toEqual({
      ok: true,
      value: { files: [], untracked: [], uncommitted: 'skipped-filters' }
    })
    await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('falls back when the worktree has a different branch checked out', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)
    repo.git(['checkout', '--quiet', '-b', 'other'], worktree)

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: repo.sha('main'),
      agentBranch: 'agent',
      worktreeDir: worktree
    })

    expect(result).toEqual({
      ok: true,
      value: { files: [], untracked: [], uncommitted: 'worktree-mismatch' }
    })
  })

  it('falls back when the directory belongs to a different repository', async (context) => {
    const git = testGit.requireGit(context)
    const { repo } = await setUp(git)
    const stranger = await testGit.newRepo(git)
    await stranger.write({ path: 'x.txt', content: 'x\n' })
    stranger.git(['add', '-A'])
    stranger.git(['commit', '--quiet', '-m', 'x'])
    stranger.git(['checkout', '--quiet', '-b', 'agent'])

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: repo.sha('main'),
      agentBranch: 'agent',
      worktreeDir: stranger.dir
    })

    expect(result).toEqual({
      ok: true,
      value: { files: [], untracked: [], uncommitted: 'worktree-mismatch' }
    })
  })

  it('falls back when the directory is a subfolder of the worktree', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)
    await repo.write({ path: 'sub/inner.txt', content: 'i\n', dir: worktree })

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: repo.sha('main'),
      agentBranch: 'agent',
      worktreeDir: join(worktree, 'sub')
    })

    expect(result).toMatchObject({ ok: true, value: { uncommitted: 'worktree-mismatch' } })
  })

  it('does not run a submodule clean filter while diffing the working tree', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)
    const sub = await testGit.newRepo(git)
    await sub.write({ path: 's.txt', content: 's\n' })
    sub.git(['add', '-A'])
    sub.git(['commit', '--quiet', '-m', 'sub'])
    const allowFile = ['-c', 'protocol.file.allow=always']
    repo.git([...allowFile, 'submodule', 'add', '--quiet', sub.dir, 'sub'])
    repo.git(['commit', '--quiet', '-m', 'add submodule'])
    repo.git(['worktree', 'remove', '--force', worktree])
    repo.git(['branch', '-f', 'agent', 'main'])
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])
    repo.git([...allowFile, 'submodule', 'update', '--init', '--quiet'], worktree)
    const inner = join(worktree, 'sub')
    const marker = join(repo.root, 'sub-filter-ran')
    repo.git(['config', 'filter.evil.clean', `touch ${marker} && cat`], inner)
    await repo.write({ path: '.gitattributes', content: '* filter=evil\n', dir: inner })
    await repo.write({ path: 's.txt', content: 'd\n', dir: inner })

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: repo.sha('main'),
      agentBranch: 'agent',
      worktreeDir: worktree
    })

    expect(result).toMatchObject({ ok: true, value: { uncommitted: 'included' } })
    await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a base that is not a full SHA', async (context) => {
    const git = testGit.requireGit(context)
    const { repo } = await setUp(git)

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: 'main' as CommitSha,
      agentBranch: 'agent'
    })

    expect(result).toEqual({ ok: false, error: 'invalid-ref' })
  })

  it.each([
    ['repoDir', { repoDir: 'rel/repo' }],
    ['worktreeDir', { worktreeDir: '' }]
  ])('returns invalid-path for a bad %s', async (_name, override) => {
    const git = toGitBinary('/nonexistent/git')
    const result = await worktreeDiffStat({
      git,
      repoDir: '/repo',
      baseSha: 'a'.repeat(40) as CommitSha,
      agentBranch: 'agent',
      worktreeDir: '/wt',
      ...override
    })
    expect(result).toEqual({ ok: false, error: 'invalid-path' })
  })

  it.each([
    ['repoDir', { repoDir: 'rel', worktreeDir: '/wt' }],
    ['worktreeDir', { repoDir: '/repo', worktreeDir: '' }]
  ])('checkWorktree rejects a bad %s', async (_name, dirs) => {
    const result = await checkWorktree({
      git: toGitBinary('/nonexistent/git'),
      agentBranch: 'agent',
      ...dirs
    })
    expect(result).toEqual({ ok: false, error: 'invalid-path' })
  })

  it('reports no-worktree, not a mismatch, when the worktree was removed', async (context) => {
    const git = testGit.requireGit(context)
    const { repo, worktree } = await setUp(git)
    repo.git(['worktree', 'remove', '--force', worktree])

    const result = await worktreeDiffStat({
      git,
      repoDir: repo.dir,
      baseSha: repo.sha('main'),
      agentBranch: 'agent',
      worktreeDir: worktree
    })

    expect(result).toEqual({
      ok: true,
      value: { files: [], untracked: [], uncommitted: 'no-worktree' }
    })
  })
})
