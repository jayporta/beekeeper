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
 * Describes why a git call failed, from git's own error output.
 * @param {unknown} error - The error `execFileSync` threw.
 * @returns {string} "git was not found", or the first line git wrote to stderr.
 */
function gitFailureReason(error) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
    return 'git was not found'
  const stderr = error instanceof Error && 'stderr' in error ? String(error.stderr).trim() : ''
  return stderr.split('\n')[0] || 'git failed'
}

/**
 * Points `core.hooksPath` at `.githooks` so git runs the review gate on
 * every commit. It fails when this isn't a git work tree, when the
 * package isn't at the root of its work tree, or when the repository's own `core.hooksPath` is already set to something else, and
 * it leaves that value alone. Only the local value blocks installing. A
 * global or system value is overridden by the local one this sets, with a
 * warning that its hooks no longer run in this repository. If another
 * config scope (such as a per-worktree value) still wins after installing,
 * it fails because the review gate is off.
 * @returns {{ ok: boolean, messages: string[] }} Whether the gate is now on, and the lines to show the user (success and warnings when ok, the reason otherwise).
 */
export function installHooks() {
  let toplevel
  try {
    toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: repoRoot,
      encoding: 'utf8'
    }).trim()
  } catch (error) {
    return {
      ok: false,
      messages: [
        `Beekeeper: this is not a git work tree, or git couldn't read it (${gitFailureReason(error)}), so no hook was installed.`
      ]
    }
  }

  if (realpathSync(toplevel) !== realpathSync(repoRoot)) {
    return {
      ok: false,
      messages: [
        'Beekeeper: this folder is not the root of its git work tree, so no hook was installed.'
      ]
    }
  }

  const existing = readHooksPath(['--local'])
  if (existing !== null && existing !== HOOKS_PATH) {
    return {
      ok: false,
      messages: [
        `Beekeeper: core.hooksPath is already set to "${existing}", so the review gate is off. Run "git config core.hooksPath ${HOOKS_PATH}" yourself to enable it.`
      ]
    }
  }

  const overridden = readHooksPath([])
  execFileSync('git', ['config', 'core.hooksPath', HOOKS_PATH], { cwd: repoRoot })

  const effective = readHooksPath([])
  if (effective !== HOOKS_PATH) {
    return {
      ok: false,
      messages: [
        `Beekeeper: another git config scope still sets core.hooksPath to "${effective}", so the review gate is off until that value is removed.`
      ]
    }
  }

  const messages = [`Beekeeper: review gate installed (core.hooksPath is now ${HOOKS_PATH}).`]
  if (overridden !== null && overridden !== HOOKS_PATH) {
    messages.push(
      `Beekeeper: ${HOOKS_PATH} now overrides core.hooksPath "${overridden}", so those hooks won't run in this repository.`
    )
  }
  return { ok: true, messages }
}
