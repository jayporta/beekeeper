import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getDiffAndPaths } from '../lib/gitProcess.mjs'
import { commit, createTestRepo, runCli, runGit, stageFile } from '../testGateFixture.mjs'

let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

describe('gate robustness', () => {
  it('blocks a diff over 1 MiB cleanly, without crashing', () => {
    activeRepo = createTestRepo()
    stageFile(
      activeRepo.repoDir,
      'src/main/big.ts',
      `export const big = '${'x'.repeat(2 * 1024 * 1024)}'\n`
    )

    const result = commit(activeRepo.repoDir)

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('code-reviewer')
  })

  it('classifies a non-ASCII path under src/main as security', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/café.ts', 'export const café = 1\n')

    const plan = runCli('plan', activeRepo.repoDir)

    expect(plan.stdout).toContain('security')
  })

  it('classifies a rename from src/main to docs.md as security', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, 'src/main/old.ts', 'export const old = 1\n')
    runCli('record', activeRepo.repoDir)
    expect(commit(activeRepo.repoDir).status).toBe(0)
    runGit(activeRepo.repoDir, ['mv', 'src/main/old.ts', 'docs.md'])

    const plan = runCli('plan', activeRepo.repoDir)

    expect(plan.stdout).toContain('security')
  })

  it('includes a GIT binary patch for a changed .gitattributes -diff file', () => {
    activeRepo = createTestRepo()
    stageFile(activeRepo.repoDir, '.gitattributes', 'secret.bin -diff\n')
    stageFile(activeRepo.repoDir, 'secret.bin', 'AAAA')
    runCli('record', activeRepo.repoDir)
    expect(commit(activeRepo.repoDir).status).toBe(0)

    writeFileSync(join(activeRepo.repoDir, 'secret.bin'), 'BBBB')
    runGit(activeRepo.repoDir, ['add', 'secret.bin'])

    const { diff } = getDiffAndPaths(activeRepo.repoDir)

    expect(diff.toString('latin1')).toContain('GIT binary patch')
  })
})
