import { lstat, realpath } from 'node:fs/promises'
import { isAbsolutePath } from '../shared/absolutePath'
import { errorCode } from '../shared/errorCode'
import { err, ok, type Result } from '../shared/result'
import { defaultFsRunner, isFsTimeout, type FsRunner } from './fsDeadline'
import type { GitBinary } from './gitBinary'
import { realCommonDir, type RealCommonDirOptions } from './gitCommonDir'
import { runGit, type GitRunError } from './runGit'

/** Options for {@link checkWorktree}. */
export interface CheckWorktreeOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The main repository directory. */
  readonly repoDir: string
  /** The worktree directory to vet. */
  readonly worktreeDir: string
  /** The branch the worktree is expected to have checked out. */
  readonly agentBranch: string
  /** Runs the filesystem calls under a deadline. Defaults to the app-wide runner. */
  readonly fsRunner?: FsRunner
}

/**
 * Whether a worktree may be diffed as a working tree: `safe`, `no-worktree`
 * when the directory no longer exists, `skipped-filters` when the repo
 * defines filter drivers (a working-tree diff would run them), or
 * `worktree-mismatch` when the directory exists but isn't the agent's linked
 * worktree of this repo (a top-level `git worktree add` checkout, not the main
 * checkout) on the agent branch, or can't be inspected.
 */
export type WorktreeVerdict = 'safe' | 'no-worktree' | 'skipped-filters' | 'worktree-mismatch'

interface GitTextOptions {
  readonly git: GitBinary
  readonly dir: string
  readonly args: readonly string[]
}

async function gitText(options: GitTextOptions): Promise<Result<string | undefined, GitRunError>> {
  const result = await runGit(options)
  if (!result.ok) return err(result.error)
  const text = result.value.stdout.toString('utf-8').trim()
  return ok(result.value.exitCode === 0 ? text : undefined)
}

/**
 * Whether the directory is gone (`true`), or present or unreadable (`false`).
 * A call that hangs past its deadline is `timeout`, so nothing later runs in a
 * directory that can't be read.
 */
async function isMissing(path: string, run: FsRunner): Promise<Result<boolean, 'timeout'>> {
  try {
    await run(() => lstat(path))
    return ok(false)
  } catch (error) {
    if (isFsTimeout(error)) return err('timeout')
    return ok(errorCode(error) === 'ENOENT')
  }
}

/**
 * Resolves a path, failing closed: a missing path, an unreadable one, and one
 * that hangs past its deadline all come back `undefined`, which the caller
 * treats as a mismatch.
 */
async function realpathOrUndefined(
  path: string | undefined,
  run: FsRunner
): Promise<string | undefined> {
  if (path === undefined || path.length === 0) return undefined
  try {
    return await run(() => realpath(path))
  } catch {
    return undefined
  }
}

/** Reads a repository's common dir, treating `not-a-repo` as absent rather than as a failure. */
async function commonDirOrUndefined(
  options: RealCommonDirOptions
): Promise<Result<string | undefined, GitRunError>> {
  const result = await realCommonDir(options)
  if (result.ok) return ok(result.value)
  return result.error === 'not-a-repo' ? ok(undefined) : err(result.error)
}

async function definesFilters(
  git: GitBinary,
  dir: string
): Promise<Result<boolean, GitRunError | 'git-failed'>> {
  const result = await runGit({ git, dir, args: ['config', '--get-regexp', '^filter\\.'] })
  if (!result.ok) return err(result.error)
  if (result.value.exitCode === 0) return ok(true)
  return result.value.exitCode === 1 ? ok(false) : err('git-failed')
}

/**
 * Decides whether a worktree's working tree can be diffed without running
 * repo-defined code and without reading the wrong repository.
 *
 * @remarks
 * A working-tree diff runs `filter.<driver>.clean` commands, so any
 * configured filter driver rules it out. The worktree must also be a linked
 * worktree (the top level of a `git worktree add` checkout) of the same
 * repository (matching `--git-common-dir`), not the main checkout, with the
 * agent branch checked out. A directory that no longer exists is
 * `no-worktree`.
 *
 * @param options - The repository, worktree, and expected branch.
 * @returns The verdict, `invalid-path` for a relative directory, `timeout` when a filesystem call hangs past its deadline, or why git could not be asked.
 */
export async function checkWorktree(
  options: CheckWorktreeOptions
): Promise<Result<WorktreeVerdict, GitRunError | 'git-failed' | 'invalid-path'>> {
  const { git, repoDir, worktreeDir } = options
  const run = options.fsRunner ?? defaultFsRunner
  if (!isAbsolutePath(repoDir) || !isAbsolutePath(worktreeDir)) return err('invalid-path')
  const missing = await isMissing(worktreeDir, run)
  if (!missing.ok) return err(missing.error)
  if (missing.value) return ok('no-worktree')
  const [filters, top, common, repoCommon, head, gitDir] = await Promise.all([
    definesFilters(git, worktreeDir),
    gitText({ git, dir: worktreeDir, args: ['rev-parse', '--show-toplevel'] }),
    commonDirOrUndefined({ git, dir: worktreeDir, fsRunner: run }),
    commonDirOrUndefined({ git, dir: repoDir, fsRunner: run }),
    gitText({ git, dir: worktreeDir, args: ['rev-parse', '--symbolic-full-name', 'HEAD'] }),
    gitText({ git, dir: worktreeDir, args: ['rev-parse', '--absolute-git-dir'] })
  ])
  if (!top.ok) return err(top.error)
  if (!common.ok) return err(common.error)
  if (!repoCommon.ok) return err(repoCommon.error)
  if (!head.ok) return err(head.error)
  if (!gitDir.ok) return err(gitDir.error)

  const [realWorktree, realTop, realGitDir] = await Promise.all([
    realpathOrUndefined(worktreeDir, run),
    realpathOrUndefined(top.value, run),
    realpathOrUndefined(gitDir.value, run)
  ])
  const matches =
    realWorktree !== undefined &&
    realWorktree === realTop &&
    common.value !== undefined &&
    common.value === repoCommon.value &&
    realGitDir !== undefined &&
    realGitDir !== common.value &&
    head.value === `refs/heads/${options.agentBranch}`
  if (!matches) return ok('worktree-mismatch')

  if (!filters.ok) return err(filters.error)
  return ok(filters.value ? 'skipped-filters' : 'safe')
}
