import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const MAX_BUFFER = 512 * 1024 * 1024

/** The audit receipt's filename, stored under a repository's git dir. */
export const RECEIPT_NAME = 'beekeeper-review-receipt'

/**
 * Finds the absolute path to the current git dir, which for a linked
 * worktree is that worktree's own dir, not the common one, so each
 * worktree keeps its own audit receipt.
 * @param {string} cwd - A directory inside the repository (a git hook runs at the work tree's top).
 * @returns {string} The git dir's absolute path.
 */
export function findGitDir(cwd) {
  const dir = execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER
  }).trim()
  return resolve(cwd, dir)
}

/**
 * Produces the diff and changed-path list the gate hashes and
 * classifies. Both read the index about to be committed: when git
 * invokes this from a hook, `GIT_INDEX_FILE` in the environment already
 * points there, however the commit was started (`-a`, a pathspec, an
 * alias, or a plain `git commit`).
 * @param {string} cwd - The work tree's top-level directory.
 * @returns {{ diff: Buffer, paths: string[] }} The staged diff's raw bytes, and its changed paths.
 */
export function getDiffAndPaths(cwd) {
  const diff = execFileSync(
    'git',
    ['diff', '--cached', '--binary', '--no-ext-diff', '--no-textconv', '--no-color'],
    { cwd, maxBuffer: MAX_BUFFER }
  )
  const pathsText = execFileSync('git', ['diff', '--cached', '--name-only', '-z', '--no-renames'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER
  })
  const paths = pathsText.split('\0').filter((path) => path.length > 0)
  return { diff, paths }
}

/**
 * Checks whether tracked files have unstaged changes relative to the
 * index being committed, which would make the checks run against
 * different content than what's about to land.
 * @param {string} cwd - The work tree's top-level directory.
 * @returns {boolean} Whether there are unstaged changes to tracked files.
 * @throws {Error} When git itself fails to run.
 */
export function hasUnstagedTrackedChanges(cwd) {
  const result = spawnSync('git', ['diff', '--quiet'], { cwd, maxBuffer: MAX_BUFFER })
  if (result.error) throw result.error
  return result.status !== 0
}

/**
 * Checks whether a merge is currently being concluded (`MERGE_HEAD`
 * exists), the same whether `cwd` is the main work tree or a linked
 * worktree, since each has its own `MERGE_HEAD`.
 * @param {string} cwd - The work tree's top-level directory.
 * @returns {boolean} Whether a merge is in progress.
 */
export function isMergeInProgress(cwd) {
  const result = spawnSync('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { cwd })
  return result.status === 0
}
