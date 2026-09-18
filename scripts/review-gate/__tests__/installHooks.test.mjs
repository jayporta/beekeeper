import { afterEach, describe, expect, it } from 'vitest'
import { commit, createUninstalledRepo, runGit, runNode, stageFile } from '../testGateFixture.mjs'

let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

describe('installHooks', () => {
  it('sets core.hooksPath, and a real commit then runs the shipped hook', () => {
    activeRepo = createUninstalledRepo()
    const install = runNode(activeRepo.installScript, [], activeRepo.repoDir)
    expect(install.status).toBe(0)

    const hooksPath = runGit(activeRepo.repoDir, ['config', '--get', 'core.hooksPath'])
    expect(hooksPath).toBe('.githooks')

    stageFile(activeRepo.repoDir, 'marker.ts', 'export const marker = 1\n')
    const commitResult = commit(activeRepo.repoDir, ['-m', 'add marker'])

    // No receipt was recorded, so the shipped hook blocks it.
    expect(commitResult.status).not.toBe(0)
    expect(commitResult.stderr).toContain('code-reviewer')
  })

  it('warns and does not overwrite an existing different core.hooksPath', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'core.hooksPath', 'some/other/hooks'])

    const install = runNode(activeRepo.installScript, [], activeRepo.repoDir)

    expect(install.status).toBe(0)
    expect(install.stdout + install.stderr).toContain('some/other/hooks')
    expect(runGit(activeRepo.repoDir, ['config', '--get', 'core.hooksPath'])).toBe(
      'some/other/hooks'
    )
  })
})
