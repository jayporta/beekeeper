import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { toGitBinary } from '../gitBinary'
import { resolveBranch } from '../resolveBranch'
import { registerTestGit } from '../testGitRepo'

/** A binary that can't run, so any git call surfaces as `spawn-failed`. */
const unrunnable = toGitBinary('/nonexistent/git')

describe('resolveBranch', () => {
  it.each(['-x', '--output=/tmp/x', '', 'main@{-1}'])(
    'rejects %j before running git',
    async (branch) => {
      const result = await resolveBranch({ git: unrunnable, repoDir: '/repo', branch })
      expect(result).toEqual({ ok: false, error: 'invalid-ref' })
    }
  )
})

describe('resolveBranch paths', () => {
  it.each(['', 'relative/repo', '.'])('rejects the repoDir %j as invalid-path', async (repoDir) => {
    const result = await resolveBranch({ git: unrunnable, repoDir, branch: 'main' })
    expect(result).toEqual({ ok: false, error: 'invalid-path' })
  })
})

describe('resolveBranch against a real repo', () => {
  const testGit = registerTestGit()

  it('resolves a branch to its tip SHA', async (context) => {
    const git = testGit.requireGit(context)
    const created = await testGit.baseRepo(git)
    const result = await resolveBranch({ git, repoDir: created.dir, branch: 'main' })
    expect(result).toEqual({ ok: true, value: created.sha('main') })
  })

  it('returns branch-not-found for a missing branch', async (context) => {
    const git = testGit.requireGit(context)
    const created = await testGit.baseRepo(git)
    const result = await resolveBranch({ git, repoDir: created.dir, branch: 'gone' })
    expect(result).toEqual({ ok: false, error: 'branch-not-found' })
  })

  it('returns branch-not-found when only a tag has the branch full name', async (context) => {
    const git = testGit.requireGit(context)
    const created = await testGit.baseRepo(git)
    created.git(['tag', 'refs/heads/ghost'])
    const result = await resolveBranch({ git, repoDir: created.dir, branch: 'ghost' })
    expect(result).toEqual({ ok: false, error: 'branch-not-found' })
  })

  it('returns git-failed, not branch-not-found, for a folder that is not a repo', async (context) => {
    const git = testGit.requireGit(context)
    const created = await testGit.newRepo(git)
    const folder = join(created.root, 'plain')
    await mkdir(folder)
    const result = await resolveBranch({ git, repoDir: folder, branch: 'main' })
    expect(result).toEqual({ ok: false, error: 'git-failed' })
  })

  it('rejects a name check-ref-format refuses', async (context) => {
    const git = testGit.requireGit(context)
    const created = await testGit.baseRepo(git)
    const result = await resolveBranch({ git, repoDir: created.dir, branch: 'a..b' })
    expect(result).toEqual({ ok: false, error: 'invalid-ref' })
  })

  it('returns git-failed, not invalid-ref, when the repo directory is missing', async (context) => {
    const git = testGit.requireGit(context)
    const created = await testGit.baseRepo(git)
    const result = await resolveBranch({
      git,
      repoDir: `${created.root}/missing`,
      branch: 'main'
    })
    expect(result).toEqual({ ok: false, error: 'git-failed' })
  })
})
