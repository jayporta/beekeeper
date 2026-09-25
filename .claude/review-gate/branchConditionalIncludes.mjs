import { gitOrNull as git } from './lib/gitQuery.mjs'

/** Config scopes that share or outrank the local value the installer writes. */
const SCOPES_AT_OR_ABOVE_LOCAL = new Set(['local', 'worktree'])

/**
 * Checks whether the repository's own config (`.git/config` or this
 * worktree's config) has an `includeIf "onbranch:…"` section. Such an
 * include applies only on matching branches, so a `core.hooksPath` inside it
 * can switch the review gate off after a checkout even though install saw
 * no value.
 * @param {string} repoRoot - The root of the worktree to check.
 * @returns {boolean} True when the local or worktree config has a branch-conditional include.
 * @throws {Error} When git fails to read the config.
 */
export function hasBranchConditionalInclude(repoRoot) {
  const listing = git(
    ['config', '--show-scope', '--name-only', '--get-regexp', '^includeif\\.onbranch:'],
    repoRoot
  )
  if (listing === null) return false
  return listing
    .split('\n')
    .some((line) => SCOPES_AT_OR_ABOVE_LOCAL.has(line.slice(0, line.indexOf('\t'))))
}
