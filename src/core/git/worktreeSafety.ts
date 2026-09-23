import { lstat, realpath } from 'node:fs/promises'
import { errorCode } from '../transcript/errorCode'
import { err, ok, type Result } from '../transcript/result'
import type { GitBinary } from './gitBinary'
import { isAbsoluteDir } from './gitPath'
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
}

/**
 * Whether a worktree may be diffed as a working tree: `safe`, `no-worktree`
 * when the directory no longer exists, `skipped-filters` when the repo
 * defines filter drivers (a working-tree diff would run them), or
 * `worktree-mismatch` when the directory exists but isn't the agent's
 * top-level worktree of this repo on the agent branch (or can't be inspected).
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

/** Whether the directory is gone (`true`), or present or unreadable (`false`). */
async function isMissing(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return false
  } catch (error) {
    return errorCode(error) === 'ENOENT'
  }
}

async function realpathOrUndefined(path: string | undefined): Promise<string | undefined> {
  if (path === undefined || path.length === 0) return undefined
  try {
    return await realpath(path)
  } catch {
    return undefined
  }
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
 * configured filter driver rules it out. The worktree must also be a
 * top-level checkout of the same repository (matching `--git-common-dir`)
 * with the agent branch checked out. A directory that no longer exists is
 * `no-worktree`.
 *
 * @param options - The repository, worktree, and expected branch.
 * @returns The verdict, `invalid-path` for a relative directory, or why git could not be asked.
 */
export async function checkWorktree(
  options: CheckWorktreeOptions
): Promise<Result<WorktreeVerdict, GitRunError | 'git-failed' | 'invalid-path'>> {
  const { git, repoDir, worktreeDir } = options
  if (!isAbsoluteDir(repoDir) || !isAbsoluteDir(worktreeDir)) return err('invalid-path')
  if (await isMissing(worktreeDir)) return ok('no-worktree')
  const commonArgs = ['rev-parse', '--path-format=absolute', '--git-common-dir']
  const [filters, top, common, repoCommon, head] = await Promise.all([
    definesFilters(git, worktreeDir),
    gitText({ git, dir: worktreeDir, args: ['rev-parse', '--show-toplevel'] }),
    gitText({ git, dir: worktreeDir, args: commonArgs }),
    gitText({ git, dir: repoDir, args: commonArgs }),
    gitText({ git, dir: worktreeDir, args: ['rev-parse', '--symbolic-full-name', 'HEAD'] })
  ])
  if (!top.ok) return err(top.error)
  if (!common.ok) return err(common.error)
  if (!repoCommon.ok) return err(repoCommon.error)
  if (!head.ok) return err(head.error)

  const [realWorktree, realTop, realCommon, realRepoCommon] = await Promise.all([
    realpathOrUndefined(worktreeDir),
    realpathOrUndefined(top.value),
    realpathOrUndefined(common.value),
    realpathOrUndefined(repoCommon.value)
  ])
  const matches =
    realWorktree !== undefined &&
    realWorktree === realTop &&
    realCommon !== undefined &&
    realCommon === realRepoCommon &&
    head.value === `refs/heads/${options.agentBranch}`
  if (!matches) return ok('worktree-mismatch')

  if (!filters.ok) return err(filters.error)
  return ok(filters.value ? 'skipped-filters' : 'safe')
}
