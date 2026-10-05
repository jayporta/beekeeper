import { isUtf8 } from 'node:buffer'
import { isAbsolutePath } from '../shared/absolutePath'
import { err, ok, type Result } from '../shared/result'
import { parseCommitSha, type CommitSha } from './commitSha'
import { pathsAssignFilters } from './filterAttributes'
import { DIFF_ARGS, UNTRACKED_ARGS } from './gitAllowlist'
import type { GitBinary } from './gitBinary'
import { parseNumstat, type NumstatEntry } from './parseNumstat'
import { resolveBranch } from './resolveBranch'
import { runGit } from './runGit'
import type {
  DiffSource,
  ResolvedWorktreeDiff,
  UncommittedStatus,
  WorktreeDiffStat,
  WorktreeDiffStatError,
  WorktreeDiffStatOptions
} from './worktreeDiffTypes'
import { checkWorktree } from './worktreeSafety'

interface MergeBaseOptions {
  readonly git: GitBinary
  readonly repoDir: string
  readonly baseSha: CommitSha
  readonly agentSha: CommitSha
}

async function findMergeBase(
  options: MergeBaseOptions
): Promise<Result<CommitSha, WorktreeDiffStatError>> {
  const result = await runGit({
    git: options.git,
    dir: options.repoDir,
    args: ['merge-base', options.baseSha, options.agentSha]
  })
  if (!result.ok) return err(result.error)
  if (result.value.exitCode === 1) return err('no-common-ancestor')
  const sha = result.value.stdout.toString('latin1').trim()
  const merge = parseCommitSha(sha)
  return result.value.exitCode === 0 && merge !== undefined ? ok(merge) : err('git-failed')
}

async function listUntracked(
  git: GitBinary,
  worktreeDir: string
): Promise<Result<string[], WorktreeDiffStatError>> {
  const result = await runGit({
    git,
    dir: worktreeDir,
    args: ['ls-files', ...UNTRACKED_ARGS, '--']
  })
  if (!result.ok) return err(result.error)
  if (result.value.exitCode !== 0) return err('git-failed')
  const paths = result.value.stdout.toString('utf-8').split('\0')
  return ok(paths.filter((path) => path.length > 0))
}

interface DiffFilesOptions extends DiffSource {
  readonly git: GitBinary
}

/** The changed files of one diff. */
interface DiffFiles {
  readonly files: NumstatEntry[]
  /**
   * Whether git's raw output is valid UTF-8. Numstat output is ASCII apart from
   * paths, so `false` means some path (a rename's old path included) has a byte
   * that decoding replaced with U+FFFD and can't be passed back to git.
   */
  readonly pathsAreUtf8: boolean
}

async function diffFiles(
  options: DiffFilesOptions
): Promise<Result<DiffFiles, WorktreeDiffStatError>> {
  const { git, dir, revisions, command } = options
  const diff = await runGit({ git, dir, args: [command, ...DIFF_ARGS, ...revisions, '--'] })
  if (!diff.ok) return err(diff.error)
  if (diff.value.exitCode !== 0) return err('git-failed')
  const files = parseNumstat(diff.value.stdout)
  if (!files.ok) return err(files.error)
  return ok({ files: files.value, pathsAreUtf8: isUtf8(diff.value.stdout) })
}

interface DiffWorkingTreeOptions {
  readonly git: GitBinary
  readonly worktreeDir: string
  readonly mergeSha: CommitSha
}

/** The paths a numstat names, a rename's old path included. */
function changedPaths(files: readonly NumstatEntry[]): string[] {
  return files.flatMap((file) =>
    file.oldPath === undefined ? [file.path] : [file.oldPath, file.path]
  )
}

/**
 * Diffs a worktree's working tree against the merge base, and lists its
 * untracked files. When any changed path has a `filter` attribute, or a path
 * isn't valid UTF-8 (so it can't be checked), the diff is discarded and
 * `skipped-filters` returned instead, since git can't apply the driver here and
 * would report the files as spurious changes.
 */
async function diffWorkingTree(
  options: DiffWorkingTreeOptions
): Promise<Result<WorktreeDiffStat | 'skipped-filters', WorktreeDiffStatError>> {
  const { git, worktreeDir, mergeSha } = options
  const [files, untracked] = await Promise.all([
    diffFiles({ git, dir: worktreeDir, command: 'diff-index', revisions: [mergeSha] }),
    listUntracked(git, worktreeDir)
  ])
  if (!files.ok) return err(files.error)
  if (!untracked.ok) return err(untracked.error)
  if (!files.value.pathsAreUtf8) return ok('skipped-filters')
  const filtered = await pathsAssignFilters({
    git,
    dir: worktreeDir,
    paths: changedPaths(files.value.files)
  })
  if (!filtered.ok) return err(filtered.error)
  if (filtered.value) return ok('skipped-filters')
  return ok({ files: files.value.files, untracked: untracked.value, uncommitted: 'included' })
}

/**
 * Decides what an agent's branch changed since it diverged from its base, and
 * which git read shows it.
 *
 * @remarks
 * Diffs against the merge base of the base and agent commits. When the
 * worktree passes {@link checkWorktree}, its working tree is diffed, so
 * uncommitted edits count, and untracked files are listed separately. The
 * working tree is read with `diff-index`, which never rewrites the index.
 * Otherwise, or when a changed path has a `filter` attribute (or a path can't
 * be checked, or too many paths changed to check them), the agent branch's
 * tip is diffed from the main repository, so only committed work shows, and
 * `uncommitted` says why.
 * Renames are detected. Everything is read-only.
 *
 * Another reading of the same changes, such as a patch, must use the returned
 * `source`, so it shows exactly the changes the summary counted and takes the
 * same precautions about filters and worktrees.
 *
 * @param options - The repository, base commit, agent branch, and optional worktree.
 * @returns The summary and its source, or why the diff could not be computed. A relative or empty directory is `invalid-path`.
 */
export async function resolveWorktreeDiff(
  options: WorktreeDiffStatOptions
): Promise<Result<ResolvedWorktreeDiff, WorktreeDiffStatError>> {
  const { git, repoDir, worktreeDir, agentBranch } = options
  const baseSha = parseCommitSha(options.baseSha)
  if (baseSha === undefined) return err('invalid-ref')
  if (!isAbsolutePath(repoDir) || (worktreeDir !== undefined && !isAbsolutePath(worktreeDir))) {
    return err('invalid-path')
  }

  const [agentAndMerge, verdict] = await Promise.all([
    resolveBranch({ git, repoDir, branch: agentBranch }).then(async (agent) =>
      agent.ok
        ? ok({
            agent: agent.value,
            merge: await findMergeBase({ git, repoDir, baseSha, agentSha: agent.value })
          })
        : agent
    ),
    worktreeDir === undefined
      ? Promise.resolve(ok('no-worktree' as const))
      : checkWorktree({ git, repoDir, worktreeDir, agentBranch })
  ])
  if (!agentAndMerge.ok) return err(agentAndMerge.error)
  if (!verdict.ok) return err(verdict.error)
  const { agent, merge } = agentAndMerge.value
  if (!merge.ok) return err(merge.error)

  let status: UncommittedStatus = verdict.value === 'safe' ? 'included' : verdict.value
  if (worktreeDir !== undefined && status === 'included') {
    const working = await diffWorkingTree({ git, worktreeDir, mergeSha: merge.value })
    if (!working.ok) return err(working.error)
    if (working.value !== 'skipped-filters') {
      return ok({
        stat: working.value,
        source: { command: 'diff-index', dir: worktreeDir, revisions: [merge.value] }
      })
    }
    status = 'skipped-filters'
  }

  const files = await diffFiles({
    git,
    dir: repoDir,
    command: 'diff',
    revisions: [merge.value, agent]
  })
  return files.ok
    ? ok({
        stat: { files: files.value.files, untracked: [], uncommitted: status },
        source: { command: 'diff', dir: repoDir, revisions: [merge.value, agent] }
      })
    : err(files.error)
}
