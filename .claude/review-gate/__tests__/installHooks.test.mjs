import { chmodSync, cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  commit,
  createUninstalledRepo,
  readLocalHooksPath,
  runGit,
  runNode,
  stageFile
} from '../testGateFixture.mjs'

const HOOKS_PATH = '.githooks'
let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

describe('cli install', () => {
  it('sets core.hooksPath, and a real commit then runs the shipped hook', () => {
    activeRepo = createUninstalledRepo()
    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)
    expect(install.status).toBe(0)
    expect(install.stdout).toContain('review gate installed')

    const hooksPath = runGit(activeRepo.repoDir, ['config', '--get', 'core.hooksPath'])
    expect(hooksPath).toBe(HOOKS_PATH)

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

      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir, env)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).toContain('/global/hooks')
      expect(
        runGit(activeRepo.repoDir, ['config', '--local', '--get', 'core.hooksPath'], env)
      ).toBe(HOOKS_PATH)
    } finally {
      rmSync(globalConfigDir, { recursive: true, force: true })
    }
  })

  it('warns that the gate is off when a worktree-scope core.hooksPath still wins', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    runGit(activeRepo.repoDir, ['config', '--worktree', 'core.hooksPath', 'worktree/hooks'])

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stdout + install.stderr).toContain('worktree/hooks')
    expect(install.stdout + install.stderr).toContain('review gate is off')
  })

  it('leaves the shared local config alone when a worktree-scope value wins', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    runGit(activeRepo.repoDir, ['config', '--worktree', 'core.hooksPath', 'worktree/hooks'])

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('another git config scope')
    expect(readLocalHooksPath(activeRepo.repoDir)).toBe('')
  })

  it('leaves the shared local config alone when a worktree-scope value is empty', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    runGit(activeRepo.repoDir, ['config', '--worktree', 'core.hooksPath', ''])

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('another git config scope')
    expect(readLocalHooksPath(activeRepo.repoDir)).toBe('')
  })

  it('leaves the shared local config alone when a command-line value wins', () => {
    activeRepo = createUninstalledRepo()
    const env = {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath',
      GIT_CONFIG_VALUE_0: 'command/hooks'
    }

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir, env)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('command/hooks')
    expect(readLocalHooksPath(activeRepo.repoDir)).toBe('')
  })

  it('refuses without writing when a command-line value hides a different worktree value', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    runGit(activeRepo.repoDir, ['config', '--worktree', 'core.hooksPath', 'wt/hooks'])
    const env = {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.hooksPath',
      GIT_CONFIG_VALUE_0: HOOKS_PATH
    }

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir, env)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('command line')
    expect(readLocalHooksPath(activeRepo.repoDir)).toBe('')
  })

  it('warns and does not overwrite an existing different core.hooksPath', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'core.hooksPath', 'some/other/hooks'])

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stdout + install.stderr).toContain('some/other/hooks')
    expect(runGit(activeRepo.repoDir, ['config', '--get', 'core.hooksPath'])).toBe(
      'some/other/hooks'
    )
  })
})

describe('cli install failure', () => {
  it('exits non-zero with a reason when the folder is not a git work tree', () => {
    activeRepo = createUninstalledRepo()
    rmSync(join(activeRepo.repoDir, '.git'), { recursive: true, force: true })

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('not a git work tree')
  })

  it("names git's own reason in its message", () => {
    activeRepo = createUninstalledRepo()
    rmSync(join(activeRepo.repoDir, '.git'), { recursive: true, force: true })

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.stderr).toMatch(/Beekeeper: .*\(fatal: not a git repository/)
  })

  // Root can write to a read-only directory, so the failure can't happen there.
  it.skipIf(process.getuid?.() === 0)(
    'reports a config it cannot write instead of throwing',
    () => {
      activeRepo = createUninstalledRepo()
      const gitDir = join(activeRepo.repoDir, '.git')
      chmodSync(gitDir, 0o555)
      try {
        const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

        expect(install.status).toBe(1)
        expect(install.stderr).toContain("git couldn't read or set core.hooksPath")
        expect(install.stderr).not.toContain('    at ')
      } finally {
        chmodSync(gitDir, 0o755)
      }
    }
  )
})

describe('cli install outside the work tree root', () => {
  it('exits non-zero when the gate copy sits below the work tree root', () => {
    activeRepo = createUninstalledRepo()
    const nestedGate = join(activeRepo.repoDir, 'nested', '.claude', 'review-gate')
    cpSync(dirname(activeRepo.cliScript), nestedGate, { recursive: true })

    const install = runNode(join(nestedGate, 'cli.mjs'), ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('not the root')
  })
})

describe('cli usage', () => {
  it('names the install subcommand when given an unknown one', () => {
    activeRepo = createUninstalledRepo()

    const result = runNode(activeRepo.cliScript, ['bogus'], activeRepo.repoDir)

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('install | plan | record')
  })
})
