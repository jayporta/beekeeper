import { err, ok, type Result } from '../shared/result'
import { PATCH_ARGS } from './gitAllowlist'
import { parseDiffPatch, type PatchFile } from './parseDiffPatch'
import { runGit } from './runGit'
import { resolveWorktreeDiff } from './resolveWorktreeDiff'
import type {
  UncommittedStatus,
  WorktreeDiffStatError,
  WorktreeDiffStatOptions
} from './worktreeDiffTypes'

/** What an agent's branch changed since it diverged from its base, as patches. */
export interface WorktreeDiffPatch {
  /** Whether the patches include uncommitted work, and why not when they don't. */
  readonly uncommitted: UncommittedStatus
  /** One patch per changed file, in git's order. A binary file's patch says it differs and nothing more. */
  readonly files: readonly PatchFile[]
}

/**
 * Reads the patch of what an agent's branch changed since it diverged from
 * its base.
 *
 * @remarks
 * It makes the same choices as {@link worktreeDiffStat} (the merge base, the
 * worktree's working tree or the branch's committed tip, and the checks that
 * make it skip a working tree it can't read safely), then runs one git diff
 * over that whole range with {@link PATCH_ARGS}: no external diff program, no
 * textconv, no color, rename detection, fixed prefixes. No path is passed to
 * git. The output is the raw file list followed by the patch, which is cut
 * into one patch per file. The size is bounded by the run's output cap, past
 * which it fails with `output-too-large`. Everything is read-only.
 *
 * @param options - The repository, base commit, agent branch, and optional worktree.
 * @returns The patches and how uncommitted work was handled, or why they could not be read. Output that doesn't parse is `malformed-numstat`.
 */
export async function worktreeDiffPatch(
  options: WorktreeDiffStatOptions
): Promise<Result<WorktreeDiffPatch, WorktreeDiffStatError>> {
  const resolved = await resolveWorktreeDiff(options)
  if (!resolved.ok) return err(resolved.error)

  const { source, stat } = resolved.value
  const run = await runGit({
    git: options.git,
    dir: source.dir,
    args: [source.command, ...PATCH_ARGS, ...source.revisions, '--']
  })
  if (!run.ok) return err(run.error)
  if (run.value.exitCode !== 0) return err('git-failed')

  const files = parseDiffPatch(run.value.stdout)
  return files.ok ? ok({ uncommitted: stat.uncommitted, files: files.value }) : err(files.error)
}
