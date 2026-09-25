import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withoutGitEnv } from './lib/envSanitize.mjs'

const REVIEW_GATE_DIR = dirname(fileURLToPath(import.meta.url))
const HOOKS_DIR = resolve(REVIEW_GATE_DIR, '..', '..', '.githooks')
const CLI_SCRIPT = resolve(REVIEW_GATE_DIR, 'cli.mjs')
const PASSING_SCRIPT = 'node -e 0'
const FAILING_SCRIPT = 'node -e "process.exit(1)"'
const DEFAULT_SCRIPTS = {
  lint: PASSING_SCRIPT,
  'format:check': PASSING_SCRIPT,
  typecheck: PASSING_SCRIPT,
  test: PASSING_SCRIPT
}

/**
 * Builds a plain, non-Claude-Code, non-git-hook environment for a
 * fixture's git calls: the current environment with every `GIT_*` and
 * `CLAUDE*` variable removed, so the tests prove the hook gates a
 * human or CI commit too, and so a real enclosing git hook (if these
 * tests are themselves run from one) can't leak into a nested fixture
 * repo. Git is also told to ignore the machine's global and system
 * config, so a developer's own settings (such as a global hooks
 * directory) can't change a fixture's behavior. Caller-supplied
 * overrides go on top of all of that.
 * @param {NodeJS.ProcessEnv} [overrides] - Extra environment variables.
 * @returns {NodeJS.ProcessEnv} The environment to spawn with.
 */
function plainEnv(overrides) {
  const base = Object.fromEntries(
    Object.entries(withoutGitEnv(process.env)).filter(([key]) => !key.startsWith('CLAUDE'))
  )
  return { ...base, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...overrides }
}

/**
 * Runs git with an argument array in a fixture repository.
 * @param {string} cwd - The repository's directory.
 * @param {string[]} args - Arguments passed to git.
 * @param {NodeJS.ProcessEnv} [env] - Extra environment variables, merged over a plain environment.
 * @returns {string} git's trimmed stdout.
 */
export function runGit(cwd, args, env) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: plainEnv(env) }).trim()
}

/**
 * Runs a Node script with a plain, non-Claude-Code, non-git-hook
 * environment, and reports the result instead of throwing.
 * @param {string} scriptPath - Absolute path to the script.
 * @param {string[]} args - Arguments passed to the script.
 * @param {string} cwd - The directory to run it from.
 * @param {NodeJS.ProcessEnv} [env] - Extra environment variables, merged over a plain environment.
 * @returns {{ status: number | null, stdout: string, stderr: string }} The script's result.
 */
export function runNode(scriptPath, args, cwd, env) {
  const result = spawnSync('node', [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: plainEnv(env)
  })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function initRepo(repoDir, scripts) {
  runGit(repoDir, ['init', '-q', '-b', 'main'])
  runGit(repoDir, ['config', 'user.email', 'test@example.com'])
  runGit(repoDir, ['config', 'user.name', 'Test'])
  runGit(repoDir, ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(repoDir, 'package.json'), JSON.stringify({ name: 'fixture', scripts }))
  writeFileSync(join(repoDir, 'README.md'), 'fixture\n')
}

function commitAll(repoDir) {
  runGit(repoDir, ['add', '.'])
  runGit(repoDir, ['commit', '-q', '-m', 'initial', '--no-verify'])
}

/**
 * Creates a temporary git repository with `core.hooksPath` pointed at
 * Beekeeper's real `.githooks`, an initial commit (made with
 * `--no-verify`, since it's fixture setup, not a case under test), and
 * a package.json whose lint/format:check/typecheck/test scripts all
 * succeed trivially, unless overridden.
 * @param {{ failingScript?: 'lint' | 'format:check' | 'typecheck' | 'test', scriptOverrides?: Record<string, string> }} [options] - A single check to fail, or explicit script bodies to use instead of the trivial default.
 * @returns {{ repoDir: string, cleanup: () => void }} The repo's path, and a function that removes it.
 */
export function createTestRepo(options = {}) {
  const repoDir = mkdtempSync(join(tmpdir(), 'beekeeper-gate-'))
  const scripts = { ...DEFAULT_SCRIPTS }
  if (options.failingScript) scripts[options.failingScript] = FAILING_SCRIPT
  Object.assign(scripts, options.scriptOverrides)

  initRepo(repoDir, scripts)
  runGit(repoDir, ['config', 'core.hooksPath', HOOKS_DIR])
  commitAll(repoDir)

  return { repoDir, cleanup: () => rmSync(repoDir, { recursive: true, force: true }) }
}

/**
 * Creates a temporary git repository with its own self-contained copy
 * of the review gate (`.claude/review-gate` and `.githooks`), but no
 * `core.hooksPath` set, so the installer's own file-relative paths
 * resolve inside it and its "not installed yet" behavior can be
 * exercised against a real repo instead of the one running the tests.
 * @returns {{ repoDir: string, cliScript: string, cleanup: () => void }} The repo's path, its copy of cli.mjs (run it with `install`), and a function that removes it.
 */
export function createUninstalledRepo() {
  const repoDir = mkdtempSync(join(tmpdir(), 'beekeeper-install-'))
  initRepo(repoDir, { ...DEFAULT_SCRIPTS })

  const gateCopy = join(repoDir, '.claude', 'review-gate')
  cpSync(REVIEW_GATE_DIR, gateCopy, {
    recursive: true,
    filter: (src) => !src.includes('__tests__')
  })
  cpSync(HOOKS_DIR, join(repoDir, '.githooks'), { recursive: true })
  chmodSync(join(repoDir, '.githooks', 'pre-commit'), 0o755)

  commitAll(repoDir)

  return {
    repoDir,
    cliScript: join(gateCopy, 'cli.mjs'),
    cleanup: () => rmSync(repoDir, { recursive: true, force: true })
  }
}

/**
 * Adds a linked worktree on a new branch, in its own temp directory.
 * @param {string} repoDir - The repository to add the worktree to.
 * @param {string} branch - The new branch to check out in the worktree.
 * @returns {{ worktreeDir: string, cleanup: () => void }} The worktree's path, and a function that removes it.
 */
export function createWorktree(repoDir, branch) {
  const parent = mkdtempSync(join(tmpdir(), 'beekeeper-gate-worktree-'))
  const worktreeDir = join(parent, 'worktree')
  runGit(repoDir, ['worktree', 'add', '-q', worktreeDir, '-b', branch])
  return { worktreeDir, cleanup: () => rmSync(parent, { recursive: true, force: true }) }
}

/**
 * Writes a file's content and stages it.
 * @param {string} repoDir - The repository's directory.
 * @param {string} relativePath - The file's path, relative to the repo.
 * @param {string} content - The file's new content.
 * @returns {void}
 */
export function stageFile(repoDir, relativePath, content) {
  const fullPath = join(repoDir, relativePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(fullPath, content)
  runGit(repoDir, ['add', '--', relativePath])
}

/**
 * Runs any git subcommand, through the repo's configured hooks, and
 * reports the result instead of throwing on a non-zero exit.
 * @param {string} repoDir - The repository's directory.
 * @param {string[]} args - Arguments passed to git.
 * @param {NodeJS.ProcessEnv} [env] - Extra environment variables, merged over a plain environment.
 * @returns {{ status: number | null, stdout: string, stderr: string }} The command's result.
 */
export function runGitAllowingFailure(repoDir, args, env) {
  const result = spawnSync('git', args, { cwd: repoDir, encoding: 'utf8', env: plainEnv(env) })
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

/**
 * Reads the `core.hooksPath` that a repository's own `.git/config` sets,
 * without following includes.
 * @param {string} repoDir - The repository's directory.
 * @returns {string} The value, or an empty string when `.git/config` doesn't set it.
 */
export function readLocalHooksPath(repoDir) {
  return runGitAllowingFailure(repoDir, [
    'config',
    '--local',
    '--get',
    'core.hooksPath'
  ]).stdout.trim()
}

/**
 * Runs a real `git commit`, through the repo's configured hooks, and
 * reports the result instead of throwing on a non-zero exit.
 * @param {string} repoDir - The repository's directory.
 * @param {string[]} [args] - Arguments passed to `git commit`.
 * @param {NodeJS.ProcessEnv} [env] - Extra environment variables, merged over a plain environment.
 * @returns {{ status: number | null, stdout: string, stderr: string }} The commit's result.
 */
export function commit(repoDir, args = ['-m', 'commit'], env) {
  return runGitAllowingFailure(repoDir, ['commit', ...args], env)
}

/**
 * Runs the review gate's `plan` or `record` CLI subcommand.
 * @param {'plan' | 'record'} subcommand - Which subcommand to run.
 * @param {string} cwd - The directory to run it from.
 * @param {NodeJS.ProcessEnv} [env] - Extra environment variables, merged over a plain environment.
 * @returns {{ status: number | null, stdout: string, stderr: string }} The command's result.
 */
export function runCli(subcommand, cwd, env) {
  return runNode(CLI_SCRIPT, [subcommand], cwd, env)
}
