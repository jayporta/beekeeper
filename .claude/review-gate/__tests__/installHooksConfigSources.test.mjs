import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createUninstalledRepo, readLocalHooksPath, runGit, runNode } from '../testGateFixture.mjs'

let activeRepo = null

afterEach(() => {
  activeRepo?.cleanup()
  activeRepo = null
})

/**
 * Rewrites the fixture repo's .git/config with a `core.hooksPath` of its own
 * (when given) and an include of a file that sets another value.
 */
function writeConfigWithInclude({ ownValue, includedValue, position }) {
  const includeFile = join(activeRepo.repoDir, 'included.gitconfig')
  writeFileSync(includeFile, `[core]\n\thooksPath = ${includedValue}\n`)
  const configFile = join(activeRepo.repoDir, '.git', 'config')
  const own = ownValue === undefined ? '' : `[core]\n\thooksPath = ${ownValue}\n`
  const original = readFileSync(configFile, 'utf8') + own
  const include = `[include]\n\tpath = ${includeFile}\n`
  writeFileSync(configFile, position === 'before' ? include + original : original + include)
}

describe('cli install with included config', () => {
  it.each(['before', 'after'])(
    'does not overwrite a value set by a config file included %s [core]',
    (position) => {
      activeRepo = createUninstalledRepo()
      writeConfigWithInclude({ includedValue: 'included/hooks', position })

      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

      expect(install.status).toBe(1)
      expect(install.stderr).toContain('already set to "included/hooks"')
      expect(install.stderr).toContain('file that .git/config includes')
      expect(readLocalHooksPath(activeRepo.repoDir)).toBe('')
    }
  )

  it("points at the include when it overrides .git/config's own .githooks", () => {
    activeRepo = createUninstalledRepo()
    writeConfigWithInclude({
      ownValue: '.githooks',
      includedValue: 'included/hooks',
      position: 'after'
    })

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(1)
    expect(install.stderr).toContain('file that .git/config includes')
  })

  it("leaves .git/config's own value alone when an include already sets .githooks", () => {
    activeRepo = createUninstalledRepo()
    writeConfigWithInclude({
      ownValue: 'user/hooks',
      includedValue: '.githooks',
      position: 'after'
    })

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(0)
    expect(install.stdout).toContain('review gate installed')
    expect(readLocalHooksPath(activeRepo.repoDir)).toBe('user/hooks')
  })
})

describe('cli install with git location variables', () => {
  it.each(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR'])(
    'refuses without writing when %s is set',
    (name) => {
      activeRepo = createUninstalledRepo()

      const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir, {
        [name]: join(activeRepo.repoDir, '.git')
      })

      expect(install.status).toBe(1)
      expect(install.stderr).toContain(`${name} is set`)
      expect(readLocalHooksPath(activeRepo.repoDir)).toBe('')
    }
  )
})

describe('cli install with branch-conditional includes', () => {
  it('warns when .git/config has an includeIf "onbranch:" section', () => {
    activeRepo = createUninstalledRepo()
    appendFileSync(
      join(activeRepo.repoDir, '.git', 'config'),
      `[includeIf "onbranch:feature"]\n\tpath = ${join(activeRepo.repoDir, 'feature.gitconfig')}\n`
    )

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(0)
    expect(install.stdout).toContain('includeIf "onbranch:" section')
  })

  it('does not warn about branch-conditional includes when there are none', () => {
    activeRepo = createUninstalledRepo()

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir)

    expect(install.status).toBe(0)
    expect(install.stdout).not.toContain('onbranch')
  })
})

describe('cli install over a global value', () => {
  it('warns that the global value is overridden when this worktree already sets .githooks', () => {
    activeRepo = createUninstalledRepo()
    const globalConfig = join(activeRepo.repoDir, '.git', 'test-global.gitconfig')
    writeFileSync(globalConfig, '[core]\n\thooksPath = global/hooks\n')
    runGit(activeRepo.repoDir, ['config', 'extensions.worktreeConfig', 'true'])
    runGit(activeRepo.repoDir, ['config', '--worktree', 'core.hooksPath', '.githooks'])

    const install = runNode(activeRepo.cliScript, ['install'], activeRepo.repoDir, {
      GIT_CONFIG_GLOBAL: globalConfig
    })

    expect(install.status).toBe(0)
    expect(install.stdout).toContain('overrides core.hooksPath "global/hooks"')
  })
})
