import { err, ok, type Result } from '../transcript/result'
import { parseCommitSha, type CommitSha } from './commitSha'
import type { GitBinary } from './gitBinary'
import { isAbsoluteDir } from './gitPath'
import { parseNumstat, type NumstatEntry } from './parseNumstat'
import { resolveBranch, type ResolveBranchError } from './resolveBranch'
import { checkWorktree } from './worktreeSafety'
import { runGit, type GitRunError } from './runGit'

/** Options for {@link worktreeDiffStat}. */
export interface WorktreeDiffStatOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The main repository directory, an absolute path, where refs are resolved. */
  readonly repoDir: string
  /** The commit the agent's work started from, from {@link resolveBranch}. Re-validated at runtime as a backstop. */
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
 *   diff would run, so only committed work is shown.
 * - `worktree-mismatch`: the directory exists but isn't the agent's worktree
 *   of this repo, so only committed work is shown.
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

/** Why {@link worktreeDiffStat} could not produce a result. */
export type WorktreeDiffStatError =
  ResolveBranchError | 'no-common-ancestor' | 'malformed-numstat' | GitRunError

const DIFF_FLAGS = [
  '--numstat',
  '-z',
  '--no-ext-diff',
  '--no-textconv',
  '--find-renames',
  '--ignore-submodules=dirty'
]

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
    args: [
      'ls-files',
      '--others',
      '--exclude-standard',
      '--directory',
      '--no-empty-directory',
      '-z',
      '--'
    ]
  })
  if (!result.ok) return err(result.error)
  if (result.value.exitCode !== 0) return err('git-failed')
  const paths = result.value.stdout.toString('utf-8').split('\0')
  return ok(paths.filter((path) => path.length > 0))
}

interface DiffFilesOptions {
  /** `diff-index` for a working tree (it never refreshes the index), `diff` for two commits. */
  readonly command: 'diff' | 'diff-index'
  readonly git: GitBinary
  readonly dir: string
  readonly revisions: readonly string[]
}

async function diffFiles(
  options: DiffFilesOptions
): Promise<Result<NumstatEntry[], WorktreeDiffStatError>> {
  const { git, dir, revisions, command } = options
  const diff = await runGit({ git, dir, args: [command, ...DIFF_FLAGS, ...revisions, '--'] })
  if (!diff.ok) return err(diff.error)
  if (diff.value.exitCode !== 0) return err('git-failed')
  return parseNumstat(diff.value.stdout)
}

/**
 * Summarizes what an agent's branch changed since it diverged from its base.
 *
 * @remarks
 * Diffs against the merge base of the base and agent commits. When the
 * worktree passes {@link checkWorktree}, its working tree is diffed, so
 * uncommitted edits count, and untracked files are listed separately. The
 * working tree is read with `diff-index`, which never rewrites the index.
 * Otherwise the agent branch's tip is diffed from the main repository and
 * `uncommitted` says why. Renames are detected. Everything is read-only.
 *
 * @param options - The repository, base commit, agent branch, and optional worktree.
 * @returns The changed files, untracked files, and how uncommitted work was handled, or why the diff could not be computed. A relative or empty directory is `invalid-path`.
 */
export async function worktreeDiffStat(
  options: WorktreeDiffStatOptions
): Promise<Result<WorktreeDiffStat, WorktreeDiffStatError>> {
  const { git, repoDir, worktreeDir, agentBranch } = options
  const baseSha = parseCommitSha(options.baseSha)
  if (baseSha === undefined) return err('invalid-ref')
  if (!isAbsoluteDir(repoDir) || (worktreeDir !== undefined && !isAbsoluteDir(worktreeDir))) {
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

  const status = verdict.value === 'safe' ? 'included' : verdict.value
  if (worktreeDir !== undefined && status === 'included') {
    const [files, untracked] = await Promise.all([
      diffFiles({ git, dir: worktreeDir, command: 'diff-index', revisions: [merge.value] }),
      listUntracked(git, worktreeDir)
    ])
    if (!files.ok) return err(files.error)
    if (!untracked.ok) return err(untracked.error)
    return ok({ files: files.value, untracked: untracked.value, uncommitted: 'included' })
  }

  const files = await diffFiles({
    git,
    dir: repoDir,
    command: 'diff',
    revisions: [merge.value, agent]
  })
  return files.ok
    ? ok({ files: files.value, untracked: [], uncommitted: status })
    : err(files.error)
}
