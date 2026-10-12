import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { installProcessPort } from '../../../core/io/installProcessPort'
import { nodeProcess } from '../../../core/io/node/nodeProcess'
import { fakeProcessPort } from '../../../core/io/testProcessPort'
import { ok } from '../../../core/shared/result'
import { registerTestGit } from '../../../core/git/testGitRepo'
import { createRepoConfiner, encodeProjectDir } from '../confineRepo'

const gitContext = registerTestGit()
const scratch: string[] = []

afterEach(async () => {
  await Promise.all(scratch.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('createRepoConfiner path separators', () => {
  it('refuses a sibling folder whose name only extends the project folder name', async (context) => {
    const git = gitContext.requireGit(context)
    const repo = await gitContext.baseRepo(git)
    const sibling = `${repo.dir}-other`
    await mkdir(sibling)
    scratch.push(sibling)
    const confiner = createRepoConfiner({
      git,
      projectDirName: encodeProjectDir(repo.dir),
      firstCwd: repo.dir
    })

    expect(await confiner.repo(sibling)).toEqual({ ok: false, error: 'outside-project' })
  })

  describe('when the project is the filesystem root', () => {
    // A repository whose top-level and common directory are both `/`, answered by a
    // fake git so nothing depends on a real repository at the root.
    beforeAll(() => {
      installProcessPort(
        fakeProcessPort(() => Promise.resolve(ok({ exitCode: 0, stdout: Buffer.from('/\n') })))
      )
    })
    afterAll(() => {
      installProcessPort(nodeProcess)
    })

    it('still accepts a directory below it', async (context) => {
      const git = gitContext.requireGit(context)
      const dir = await mkdtemp(join(tmpdir(), 'beekeeper-root-'))
      scratch.push(dir)
      const confiner = createRepoConfiner({
        git,
        projectDirName: encodeProjectDir('/'),
        firstCwd: '/'
      })

      expect(await confiner.repo(dir)).toEqual({ ok: true, value: '/' })
    })
  })
})
