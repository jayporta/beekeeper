import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createUninstalledRepo, createWorktree, runGit, runNode } from '../testGateFixture.mjs'

let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

describe('cli install with other worktrees', () => {
  it("warns about another worktree's own core.hooksPath and still succeeds", () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    const other = createWorktree(activeRepo.repoDir, 'other')
    try {
      runGit(other.worktreeDir, ['config', '--worktree', 'core.hooksPath', 'elsewhere/hooks'])

      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).toContain(realpathSync(other.worktreeDir))
      expect(install.stdout + install.stderr).toContain('"elsewhere/hooks"')
    } finally {
      other.cleanup()
    }
  })

  it("warns about another worktree's core.hooksPath set through an include", () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    const other = createWorktree(activeRepo.repoDir, 'other')
    const includeDir = mkdtempSync(join(tmpdir(), 'beekeeper-include-'))
    const includeFile = join(includeDir, 'hooks.gitconfig')
    writeFileSync(includeFile, '[core]\n\thooksPath = included/hooks\n')
    try {
      runGit(other.worktreeDir, ['config', '--worktree', 'include.path', includeFile])

      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).toContain('"included/hooks"')
    } finally {
      other.cleanup()
      rmSync(includeDir, { recursive: true, force: true })
    }
  })

  it("warns about another worktree's core.hooksPath set by a conditional include", () => {
    activeRepo = createUninstalledRepo()
    const other = createWorktree(activeRepo.repoDir, 'other')
    const includeDir = mkdtempSync(join(tmpdir(), 'beekeeper-include-'))
    const includeFile = join(includeDir, 'cond.gitconfig')
    writeFileSync(includeFile, '[core]\n\thooksPath = cond/hooks\n')
    try {
      appendFileSync(
        join(activeRepo.repoDir, '.git', 'config'),
        `[includeIf "onbranch:other"]\n\tpath = ${includeFile}\n`
      )

      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).toContain(realpathSync(other.worktreeDir))
      expect(install.stdout + install.stderr).toContain('"cond/hooks"')
    } finally {
      other.cleanup()
      rmSync(includeDir, { recursive: true, force: true })
    }
  })

  it('does not warn about a worktree without its own core.hooksPath', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    const other = createWorktree(activeRepo.repoDir, 'other')
    try {
      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).not.toMatch(/worktree/)
    } finally {
      other.cleanup()
    }
  })

  it('does not warn about the bare repository a worktree belongs to', () => {
    activeRepo = createUninstalledRepo()
    const bareParent = mkdtempSync(join(tmpdir(), 'beekeeper-bare-'))
    const bareDir = join(bareParent, 'repo.git')
    runGit(bareParent, ['clone', '-q', '--bare', activeRepo.repoDir, bareDir])
    const worktree = createWorktree(bareDir, 'other')
    try {
      const cliScript = join(worktree.worktreeDir, '.claude', 'review-gate', 'cli.mjs')
      const install = runNode(cliScript, ['install'], worktree.worktreeDir)

      expect(install.status).toBe(0)
      expect(install.stdout).toContain('review gate installed')
      expect(install.stdout + install.stderr).not.toMatch(/worktree/)
    } finally {
      worktree.cleanup()
      rmSync(bareParent, { recursive: true, force: true })
    }
  })

  it('ignores extensions.worktreeConfig set outside the repository', () => {
    activeRepo = createUninstalledRepo()
    const globalConfigDir = mkdtempSync(join(tmpdir(), 'beekeeper-global-config-'))
    const env = { GIT_CONFIG_GLOBAL: join(globalConfigDir, 'gitconfig') }
    runGit(activeRepo.repoDir, [
      'config',
      '--file',
      env.GIT_CONFIG_GLOBAL,
      'extensions.worktreeConfig',
      'true'
    ])
    const other = createWorktree(activeRepo.repoDir, 'other')
    try {
      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir, env)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).not.toMatch(/worktree/)
    } finally {
      other.cleanup()
      rmSync(globalConfigDir, { recursive: true, force: true })
    }
  })

  it('installs when another worktree directory no longer exists', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    const other = createWorktree(activeRepo.repoDir, 'other')
    rmSync(other.worktreeDir, { recursive: true, force: true })
    try {
      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout).toContain('review gate installed')
      expect(install.stdout + install.stderr).not.toMatch(/worktree/)
    } finally {
      other.cleanup()
    }
  })

  it("never reports another repository's value for a reused worktree path", () => {
    activeRepo = createUninstalledRepo()
    const other = createWorktree(activeRepo.repoDir, 'other')
    rmSync(other.worktreeDir, { recursive: true, force: true })
    mkdirSync(other.worktreeDir)
    runGit(other.worktreeDir, ['init', '-q'])
    runGit(other.worktreeDir, ['config', 'core.hooksPath', 'stranger/hooks'])
    try {
      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout + install.stderr).not.toContain('stranger/hooks')
      expect(install.stdout).toContain("couldn't read the config of worktree")
    } finally {
      other.cleanup()
    }
  })

  it('still succeeds, with a warning, when git cannot read another worktree', () => {
    activeRepo = createUninstalledRepo()
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    const other = createWorktree(activeRepo.repoDir, 'other')
    writeFileSync(join(other.worktreeDir, '.git'), 'gitdir: /nonexistent\n')
    try {
      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(0)
      expect(install.stdout).toContain('review gate installed')
      expect(install.stdout).toContain("couldn't read the config of worktree")
    } finally {
      other.cleanup()
    }
  })
})
