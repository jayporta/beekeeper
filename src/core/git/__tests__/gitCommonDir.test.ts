import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { realCommonDir } from '../gitCommonDir'
import { registerTestGit } from '../testGitRepo'

const testGit = registerTestGit()

describe('realCommonDir', () => {
  it('returns the real .git directory for a repository', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)

    expect(await realCommonDir({ git, dir: repo.dir })).toEqual({
      ok: true,
      value: await realpath(join(repo.dir, '.git'))
    })
  })

  it('returns the same common dir from a linked worktree', async (context) => {
    const git = testGit.requireGit(context)
    const repo = await testGit.baseRepo(git)
    const worktree = join(repo.root, 'wt')
    repo.git(['worktree', 'add', '--quiet', worktree, 'agent'])

    const [fromRepo, fromWorktree] = await Promise.all([
      realCommonDir({ git, dir: repo.dir }),
      realCommonDir({ git, dir: worktree })
    ])

    expect(fromWorktree).toEqual({ ok: true, value: await realpath(join(repo.dir, '.git')) })
    expect(fromWorktree).toEqual(fromRepo)
  })

  it('reports not-a-repo for a plain directory', async (context) => {
    const git = testGit.requireGit(context)
    const { root } = await testGit.newRepo(git)

    expect(await realCommonDir({ git, dir: root })).toEqual({ ok: false, error: 'not-a-repo' })
  })
})
