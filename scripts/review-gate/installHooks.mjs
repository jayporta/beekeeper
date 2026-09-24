#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOKS_PATH = '.githooks'
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

/**
 * Reads `core.hooksPath` from git config.
 * @param {string[]} scopeArgs - Extra `git config` arguments, such as `['--local']`. Empty reads the effective value.
 * @returns {string | null} The value, or null when it isn't set.
 */
function readHooksPath(scopeArgs) {
  try {
    return execFileSync('git', ['config', ...scopeArgs, '--get', 'core.hooksPath'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim()
  } catch {
    return null
  }
}

/**
 * Points `core.hooksPath` at `.githooks` so git runs the review gate on
 * every commit, but only when this package is actually a git
 * work tree (not, for example, extracted from a tarball with no `.git`
 * at all) and the repository's own `core.hooksPath` isn't already set to
 * something else. Only the local value blocks installing. A global or
 * system value is overridden by the local one this sets, with a warning
 * that its hooks no longer run in this repository. If another config
 * scope (such as a per-worktree value) still wins after installing, it
 * warns that the review gate is off.
 * @returns {void}
 */
function installHooks() {
  let toplevel
  try {
    toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim()
  } catch {
    return
  }

  if (realpathSync(toplevel) !== realpathSync(repoRoot)) return

  const existing = readHooksPath(['--local'])
  if (existing !== null && existing !== HOOKS_PATH) {
    console.warn(
      `Beekeeper: core.hooksPath is already set to "${existing}". Run "git config core.hooksPath ${HOOKS_PATH}" yourself to enable the review gate.`
    )
    return
  }

  const overridden = readHooksPath([])
  execFileSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd: repoRoot })

  const effective = readHooksPath([])
  if (effective !== HOOKS_PATH) {
    console.warn(
      `Beekeeper: another git config scope still sets core.hooksPath to "${effective}", so the review gate is off until that value is removed.`
    )
  } else if (overridden !== null && overridden !== HOOKS_PATH) {
    console.warn(
      `Beekeeper: ${HOOKS_PATH} now overrides core.hooksPath "${overridden}", so those hooks won't run in this repository.`
    )
  }
}

installHooks()
