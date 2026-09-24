import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  it('installs into the repo even when a global core.hooksPath is set', () => {
    activeRepo = createUninstalledRepo()
    const globalConfigDir = mkdtempSync(join(tmpdir(), 'beekeeper-global-config-'))
    const globalConfig = join(globalConfigDir, 'gitconfig')
    try {
      const env = { GIT_CONFIG_GLOBAL: globalConfig }
      runGit(activeRepo.repoDir, [
        'config',
        '--file',
        globalConfig,
        'core.hooksPath',
        '/global/hooks'
      ])

      const install = runNode(activeRepo.installScript, [], activeRepo.repoDir, env)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).toContain('/global/hooks')
      expect(
        runGit(activeRepo.repoDir, ['config', '--local', '--get', 'core.hooksPath'], env)
      ).toBe('.githooks')
    } finally {
      rmSync(globalConfigDir, { recursive: true, force: true })
    }
  })

  it('warns that the gate is off when a worktree-scope core.hooksPath still wins', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    runGit(activeRepo.repoDir, ['config', '--worktree', 'core.hooksPath', 'worktree/hooks'])

    const install = runNode(activeRepo.installScript, [], activeRepo.repoDir)

    expect(install.status).toBe(0)
    expect(install.stdout + install.stderr).toContain('worktree/hooks')
    expect(install.stdout + install.stderr).toContain('review gate is off')
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
