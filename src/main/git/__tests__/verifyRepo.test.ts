import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { verifyRepo } from '../verifyRepo'

const gitContext = registerTestGit()
const scratch: string[] = []

afterEach(async () => {
  await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function scratchDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'beekeeper-verify-'))
  scratch.push(dir)
  return dir
}

describe('verifyRepo', () => {
  it('reports repo-missing for a path that does not exist', async (context) => {
    const git = gitContext.requireGit(context)
    const dir = await scratchDir()

    expect(await verifyRepo({ git, dir: join(dir, 'nope') })).toEqual({
      ok: false,
      error: 'repo-missing'
    })
  })

  it('reports repo-missing for a relative path', async (context) => {
    const git = gitContext.requireGit(context)

    expect(await verifyRepo({ git, dir: 'relative' })).toEqual({ ok: false, error: 'repo-missing' })
  })

  it('reports not-a-repo for a regular file', async (context) => {
    const git = gitContext.requireGit(context)
    const dir = await scratchDir()
    const file = join(dir, 'file.txt')
    await writeFile(file, 'x')

    expect(await verifyRepo({ git, dir: file })).toEqual({ ok: false, error: 'not-a-repo' })
  })

  it('reports not-a-repo for a directory outside any repository', async (context) => {
    const git = gitContext.requireGit(context)
    const dir = await scratchDir()

    expect(await verifyRepo({ git, dir })).toEqual({ ok: false, error: 'not-a-repo' })
  })

  it('resolves a symlink to the real top-level of the repo', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const dir = await scratchDir()
    const link = join(dir, 'link')
    await symlink(repo.dir, link)

    expect(await verifyRepo({ git, dir: link })).toEqual({
      ok: true,
      value: await realpath(repo.dir)
    })
  })

  it('returns the top-level for a subdirectory of a repo', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const sub = join(repo.dir, 'a', 'b')
    await mkdir(sub, { recursive: true })

    expect(await verifyRepo({ git, dir: sub })).toEqual({
      ok: true,
      value: await realpath(repo.dir)
    })
  })
})
