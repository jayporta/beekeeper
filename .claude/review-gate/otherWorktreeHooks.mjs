import { existsSync, realpathSync } from 'node:fs'
import { gitOrNull as git } from './lib/gitQuery.mjs'

/**
 * Finds the other linked worktrees whose effective `core.hooksPath` (from a
 * per-worktree config, or a conditional include in the shared config) is
 * something other than the gate's hooks directory, which keeps the review
 * gate off there. A bare repository's own directory, which git lists as a
 * worktree, is skipped. A worktree whose config git can't read (a moved
 * repository, a reused path, or one git's ownership check rejects) is
 * listed with a null value rather than stopping the scan.
 * @param {string} repoRoot - The root of the worktree the installer runs in.
 * @param {string} hooksPath - The `core.hooksPath` value that turns the gate on.
 * @returns {{ path: string, value: string | null }[]} Each affected worktree's path and its `core.hooksPath` value, or null when git couldn't read it.
 * @throws {Error} When git fails to list the repository's worktrees.
 */
export function findOtherWorktreeHooks(repoRoot, hooksPath) {
  const listing = git(['worktree', 'list', '--porcelain'], repoRoot) ?? ''
  const repo = { current: realpathSync(repoRoot), commonDir: commonDirOf(repoRoot) }
  const found = []
  for (const entry of listing.split('\n\n')) {
    const lines = entry.split('\n')
    const first = lines[0] ?? ''
    if (!first.startsWith('worktree ') || lines.includes('bare')) continue
    const path = first.slice('worktree '.length)
    if (!existsSync(path)) continue
    const value = readWorktreeHooksPath(path, repo)
    if (value !== undefined && value !== hooksPath) found.push({ path, value })
  }
  return found
}

/**
 * Resolves the shared git directory of the repository a directory belongs to.
 * @param {string} dir - A directory inside a work tree.
 * @returns {string} The real path of its common git directory.
 * @throws {Error} When git can't read the directory as a work tree.
 */
function commonDirOf(dir) {
  const output = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], dir) ?? ''
  return realpathSync(output.trim())
}

/**
 * Reads one other worktree's effective `core.hooksPath`, but only when the
 * directory is still the top level of a worktree of this repository. A
 * listed path reused by a plain folder or another repository counts as
 * unreadable, so a value from some other repository's config is never
 * reported, though git still parses that config to find its top level.
 * @param {string} path - The worktree's directory, as `git worktree list` gives it.
 * @param {{ current: string, commonDir: string }} repo - The real paths of the installer's worktree and of the repository's common git directory.
 * @returns {string | null | undefined} The value; undefined when it's the current worktree or unset; null when it can't be read as this repository's worktree.
 */
function readWorktreeHooksPath(path, repo) {
  try {
    const real = realpathSync(path)
    if (real === repo.current) return undefined
    const toplevel = (git(['rev-parse', '--show-toplevel'], path) ?? '').trim()
    if (realpathSync(toplevel) !== real || commonDirOf(path) !== repo.commonDir) return null
    const value = git(['config', '--get', 'core.hooksPath'], path)
    return value === null ? undefined : value.replace(/\n$/, '')
  } catch {
    return null
  }
}
