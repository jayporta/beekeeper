import { err, ok, type Result } from '../shared/result'
import { resolveWorktreeDiff } from './resolveWorktreeDiff'
import type {
  WorktreeDiffStat,
  WorktreeDiffStatError,
  WorktreeDiffStatOptions
} from './worktreeDiffTypes'

export type {
  UncommittedStatus,
  WorktreeDiffStat,
  WorktreeDiffStatError,
  WorktreeDiffStatOptions
} from './worktreeDiffTypes'

/**
 * Summarizes what an agent's branch changed since it diverged from its base.
 * See {@link resolveWorktreeDiff} for how the changes are chosen.
 *
 * @param options - The repository, base commit, agent branch, and optional worktree.
 * @returns The changed files, untracked files, and how uncommitted work was handled, or why the diff could not be computed. A relative or empty directory is `invalid-path`.
 */
export async function worktreeDiffStat(
  options: WorktreeDiffStatOptions
): Promise<Result<WorktreeDiffStat, WorktreeDiffStatError>> {
  const resolved = await resolveWorktreeDiff(options)
  return resolved.ok ? ok(resolved.value.stat) : err(resolved.error)
}
