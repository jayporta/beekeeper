#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOKS_PATH = '.githooks'
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

function currentHooksPath() {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
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
 * at all) and `core.hooksPath` isn't already set to something else.
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

  const existing = currentHooksPath()
  if (existing !== null && existing !== HOOKS_PATH) {
    console.warn(
      `Beekeeper: core.hooksPath is already set to "${existing}". Run "git config core.hooksPath ${HOOKS_PATH}" yourself to enable the review gate.`
    )
    return
  }

  execFileSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd: repoRoot })
}

installHooks()
