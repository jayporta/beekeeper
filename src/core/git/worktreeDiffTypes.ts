import type { CommitSha } from './commitSha'
import type { GitBinary } from './gitBinary'
import type { NumstatEntry } from './parseNumstat'
import type { ResolveBranchError } from './resolveBranch'
import type { GitRunError } from './runGit'

/** Options for `worktreeDiffStat`, `resolveWorktreeDiff`, and `worktreeDiffPatch`. */
export interface WorktreeDiffStatOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The main repository directory, an absolute path, where refs are resolved. */
  readonly repoDir: string
  /** The commit the agent's work started from, from `resolveBranch`. Re-validated at runtime as a backstop. */
  readonly baseSha: CommitSha
  /** The agent's branch. */
  readonly agentBranch: string
  /** The agent's worktree, an absolute path, when it still exists. */
  readonly worktreeDir?: string
}

/**
 * How uncommitted work was handled:
 * - `included`: the worktree's working tree was diffed.
 * - `no-worktree`: no worktree was given or it no longer exists, so only
 *   committed work is shown.
 * - `skipped-filters`: the repo defines filter drivers that a working-tree
 *   diff would run, or an attribute assigns a filter to a changed path (as
 *   Git LFS does, with its driver defined outside the repo), or a changed
 *   path isn't valid UTF-8 and can't be checked, so only committed work is
 *   shown.
 * - `worktree-mismatch`: the directory exists but isn't the agent's linked
 *   worktree of this repo (the main checkout doesn't count), so only
 *   committed work is shown.
 */
export type UncommittedStatus = 'included' | 'no-worktree' | 'skipped-filters' | 'worktree-mismatch'

/** What an agent's branch changed relative to where it diverged from its base. */
export interface WorktreeDiffStat {
  /** Whether the files include uncommitted work, and why not when they don't. */
  readonly uncommitted: UncommittedStatus
  /** Changed tracked files with their line counts. */
  readonly files: readonly NumstatEntry[]
  /** Untracked paths in the worktree that repo ignore rules don't cover. Global ignore files aren't applied, so it may list files the user ignores only globally. An untracked folder counts as one entry with a trailing slash. Empty unless `uncommitted` is `included`. */
  readonly untracked: readonly string[]
}

/**
 * Which git read produces a diff, and where: `diff` of two commits from the
 * main repository, or `diff-index` of the merge base against a worktree's
 * working tree.
 */
export interface DiffSource {
  /** `diff-index` for a working tree (it never refreshes the index), `diff` for two commits. */
  readonly command: 'diff' | 'diff-index'
  /** The directory git runs in. */
  readonly dir: string
  /** The revisions to compare: the merge base, then the agent commit for `diff`. */
  readonly revisions: readonly string[]
}

/** What `resolveWorktreeDiff` decided. */
export interface ResolvedWorktreeDiff {
  /** The changed files, by the decision's own numstat. */
  readonly stat: WorktreeDiffStat
  /** The git read that shows the same changes in another format. */
  readonly source: DiffSource
}

/** Why `worktreeDiffStat`, `resolveWorktreeDiff`, or `worktreeDiffPatch` could not produce a result. */
export type WorktreeDiffStatError =
  ResolveBranchError | 'no-common-ancestor' | 'malformed-numstat' | GitRunError
