import { mkdir, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hangingFsRunner } from '../../../core/git/testFsRunner'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { createRepoConfiner, encodeProjectDir, type RepoConfinerOptions } from '../confineRepo'
import type { GitBinary } from '../../../core/git/gitBinary'

const gitContext = registerTestGit()

/** Filesystem calls that establishing the project makes: verifyRepo (3), the common dir (1), resolveFirstCwd (2). */
const ESTABLISH_CALLS = 6

function confinerFor(
  git: GitBinary,
  repoDir: string,
  fsRunner: RepoConfinerOptions['fsRunner']
): ReturnType<typeof createRepoConfiner> {
  return createRepoConfiner({
    git,
    projectDirName: encodeProjectDir(repoDir),
    firstCwd: repoDir,
    fsRunner
  })
}

describe('createRepoConfiner when a filesystem call hangs', () => {
  it('reports timeout for a spawn when establishing the project hangs', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const confiner = confinerFor(git, repo.dir, hangingFsRunner({ passes: 0 }))

    expect(await confiner.repo(repo.dir)).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports timeout, not outside-project, when walking a spawn path hangs', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const sub = join(repo.dir, 'sub')
    await mkdir(sub)
    const confiner = confinerFor(git, repo.dir, hangingFsRunner({ passes: ESTABLISH_CALLS }))

    expect(await confiner.repo(sub)).toEqual({ ok: false, error: 'timeout' })
  })

  it('reports timeout, not an absent worktree, when walking a worktree path hangs', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const sub = join(repo.dir, 'sub')
    await mkdir(sub)
    const confiner = confinerFor(git, repo.dir, hangingFsRunner({ passes: ESTABLISH_CALLS }))

    expect(await confiner.worktree(sub)).toEqual({ ok: false, error: 'timeout' })
  })

  it('still establishes the project when only resolving the first cwd hangs', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const confiner = confinerFor(git, repo.dir, hangingFsRunner({ passes: 4, hangs: 1 }))

    const top = await realpath(repo.dir)

    expect(await confiner.repo(top)).toEqual({ ok: true, value: top })
  })
})
