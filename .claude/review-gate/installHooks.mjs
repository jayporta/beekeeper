import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hasBranchConditionalInclude } from './branchConditionalIncludes.mjs'
import { gitOrNull } from './lib/gitQuery.mjs'
import { findOtherWorktreeHooks } from './otherWorktreeHooks.mjs'

const HOOKS_PATH = '.githooks'
/** Environment variables that make git use a repository other than the one around the installer. */
const GIT_LOCATION_VARIABLES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR']
/** Config scopes git ranks above the local config, so a local value can't override them. */
const SCOPES_ABOVE_LOCAL = new Set(['worktree'])
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')

/**
 * Reads `core.hooksPath` from git config.
 * @param {string[]} scopeArgs - Extra `git config` arguments, such as `['--local', '--includes']`. Empty reads the effective value.
 * @returns {string | null} git's output without its trailing newline, or null when the key isn't set.
 * @throws {Error} When git fails for any other reason, such as a malformed config file.
 */
function readHooksPath(scopeArgs) {
  const output = gitOrNull(['config', ...scopeArgs, '--get', 'core.hooksPath'], repoRoot)
  return output === null ? null : output.replace(/\n$/, '')
}

/**
 * Reads the effective `core.hooksPath` and the config scope it comes from.
 * @returns {{ scope: string, value: string } | null} The winning value and its scope, or null when it isn't set.
 * @throws {Error} When git fails for any reason other than the key being unset.
 */
function readEffectiveHooksPath() {
  const line = readHooksPath(['--show-scope'])
  if (line === null) return null
  const tab = line.indexOf('\t')
  return { scope: line.slice(0, tab), value: line.slice(tab + 1) }
}

/**
 * Reads the global or system `core.hooksPath` that a local value overrides.
 * @returns {string | null} The global value if set, else the system value, or null when neither is set.
 * @throws {Error} When git fails for any reason other than the key being unset.
 */
function readLowerScopeHooksPath() {
  return readHooksPath(['--global', '--includes']) ?? readHooksPath(['--system', '--includes'])
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
 * it leaves that value alone, since it never overwrites a local value. A
 * global or system value is overridden by the local one this sets, with a
 * warning that its hooks no longer run in this repository. When a scope
 * that outranks the local config (a per-worktree value) sets something
 * else, it fails without writing anything, since the local value is shared
 * by every worktree. A value given on the command line or via
 * `GIT_CONFIG_*` also fails without writing, whatever it is, since it hides
 * what applies without it. It refuses when `GIT_DIR`, `GIT_WORK_TREE` or
 * `GIT_COMMON_DIR` is set, since those can point git at another repository.
 * It also fails when git can't read or
 * write the config. On success it also warns about each other linked
 * worktree whose own per-worktree `core.hooksPath` keeps the gate off there,
 * and about any `includeIf "onbranch:…"` in the repository's own config.
 * @returns {{ ok: boolean, messages: string[] }} Whether the gate is now on, and the lines to show the user (success and warnings when ok, the reason otherwise).
 */
export function installHooks() {
  const redirects = GIT_LOCATION_VARIABLES.filter((name) => process.env[name])
  if (redirects.length > 0) {
    return {
      ok: false,
      messages: [
        `Beekeeper: ${redirects.join(', ')} is set, which can point git at another repository, so no hook was installed. Run install without it.`
      ]
    }
  }

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

  try {
    return configureHooksPath()
  } catch (error) {
    return {
      ok: false,
      messages: [
        `Beekeeper: git couldn't read or set core.hooksPath (${gitFailureReason(error)}), so no hook was installed.`
      ]
    }
  }
}

/**
 * Sets the local `core.hooksPath` to `.githooks` unless a value it can't
 * or shouldn't override is already in place, then confirms it took effect.
 * @returns {{ ok: boolean, messages: string[] }} Whether the gate is now on, and the lines to show the user.
 * @throws {Error} When a git config read or write fails.
 */
function configureHooksPath() {
  const before = readEffectiveHooksPath()
  if (before !== null && before.scope === 'command') return offByCommandLine(before.value)

  const existing = readHooksPath(['--local', '--includes'])
  if (existing !== null && existing !== HOOKS_PATH) {
    const fromInclude = readHooksPath(['--local']) !== existing
    const advice = fromInclude
      ? 'That value comes from a file that .git/config includes, so remove it there to use the gate.'
      : `Run "git config core.hooksPath ${HOOKS_PATH}" yourself to use the gate.`
    return {
      ok: false,
      messages: [
        `Beekeeper: this repository's core.hooksPath is already set to "${existing}", so install left it alone, and the review gate won't run wherever that value applies. ${advice}`
      ]
    }
  }

  if (before !== null && SCOPES_ABOVE_LOCAL.has(before.scope) && before.value !== HOOKS_PATH) {
    return offByOtherScope(before.value)
  }

  // Already in effect locally (possibly through an include): writing would
  // only replace whatever .git/config holds underneath it.
  const overridden = existing === HOOKS_PATH ? null : readLowerScopeHooksPath()
  if (existing !== HOOKS_PATH) {
    execFileSync('git', ['config', '--local', 'core.hooksPath', HOOKS_PATH], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    })
  }

  const effective = readHooksPath([])
  if (effective !== HOOKS_PATH) return offByOtherScope(effective)

  const messages = [`Beekeeper: review gate installed (core.hooksPath is now ${HOOKS_PATH}).`]
  if (overridden !== null && overridden !== HOOKS_PATH) {
    messages.push(
      `Beekeeper: ${HOOKS_PATH} now overrides core.hooksPath "${overridden}", so those hooks won't run in this repository.`
    )
  }
  if (hasBranchConditionalInclude(repoRoot)) {
    messages.push(
      'Beekeeper: this repository\'s config has an includeIf "onbranch:" section. If one sets core.hooksPath, the review gate is off on the branches it matches.'
    )
  }
  messages.push(...otherWorktreeWarnings())
  return { ok: true, messages }
}

/**
 * Warns about other linked worktrees where the review gate stays off. The
 * install has already succeeded by the time this runs, so a failed check is
 * a warning too, never a failure.
 * @returns {string[]} One warning per affected worktree, or one for a check that couldn't run.
 */
function otherWorktreeWarnings() {
  let others
  try {
    others = findOtherWorktreeHooks(repoRoot, HOOKS_PATH)
  } catch (error) {
    return [
      `Beekeeper: couldn't check other worktrees for their own core.hooksPath (${gitFailureReason(error)}).`
    ]
  }
  return others.map(({ path, value }) =>
    value === null
      ? `Beekeeper: git couldn't read the config of worktree ${path}, so the review gate may be off there.`
      : `Beekeeper: the review gate stays off in ${path}, which sets core.hooksPath to "${value}" for that worktree.`
  )
}

/**
 * The failure result for a `core.hooksPath` given on the command line or via
 * `GIT_CONFIG_*`, which hides whatever applies without it.
 * @param {string} value - The command-line value.
 * @returns {{ ok: false, messages: string[] }} The failure and its reason.
 */
function offByCommandLine(value) {
  return {
    ok: false,
    messages: [
      `Beekeeper: core.hooksPath is set to "${value}" on the command line or via GIT_CONFIG_* for this run, which hides the value that applies without it, so install wrote nothing. Run install without it.`
    ]
  }
}

/**
 * The failure result for a `core.hooksPath` set by a config scope the
 * local value can't override.
 * @param {string | null} value - The value that wins.
 * @returns {{ ok: false, messages: string[] }} The failure and its reason.
 */
function offByOtherScope(value) {
  return {
    ok: false,
    messages: [
      `Beekeeper: another git config scope sets core.hooksPath to "${value}", so the review gate is off. Remove that value, then run install again.`
    ]
  }
}
