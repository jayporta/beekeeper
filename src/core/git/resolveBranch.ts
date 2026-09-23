import { err, ok, type Result } from '../transcript/result'
import { parseCommitSha, type CommitSha } from './commitSha'
import type { GitBinary } from './gitBinary'
import { isAbsoluteDir } from './gitPath'
import { runGit, type GitRunError } from './runGit'

/** Why a branch name could not be resolved to a commit. */
export type ResolveBranchError =
  'invalid-ref' | 'invalid-path' | 'branch-not-found' | 'git-failed' | GitRunError

/** Options for {@link resolveBranch}. */
export interface ResolveBranchOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** The repository directory to resolve in. */
  readonly repoDir: string
  /** A local branch name, exactly as recorded, e.g. `feat/login`. */
  readonly branch: string
}

/**
 * Resolves a local branch name to the SHA of its tip commit.
 *
 * @remarks
 * Rejects names that start with `-`, contain `@{`, or fail
 * `git check-ref-format refs/heads/<branch>` (which exits 1 for a bad name,
 * unlike `--branch`, which exits 128), then resolves `refs/heads/<branch>`.
 * The ref's full name must be exactly that, so a tag named
 * `refs/heads/<branch>` or a SHA-like name can't stand in for a branch. Only
 * the returned SHA should reach later `merge-base` and `diff` calls.
 *
 * @param options - The repository and branch name.
 * @returns The commit SHA, or why the branch can't be used. A missing branch is `branch-not-found`, and a relative `repoDir` is `invalid-path`.
 */
export async function resolveBranch(
  options: ResolveBranchOptions
): Promise<Result<CommitSha, ResolveBranchError>> {
  const { git, repoDir, branch } = options
  if (!isAbsoluteDir(repoDir)) return err('invalid-path')
  if (branch.length === 0 || branch.startsWith('-') || branch.includes('@{')) {
    return err('invalid-ref')
  }

  const format = await runGit({
    git,
    dir: repoDir,
    args: ['check-ref-format', `refs/heads/${branch}`]
  })
  if (!format.ok) return err(format.error)
  if (format.value.exitCode === 1) return err('invalid-ref')
  if (format.value.exitCode !== 0) return err('git-failed')

  const fullName = `refs/heads/${branch}`
  const [parsed, symbolic] = await Promise.all([
    runGit({
      git,
      dir: repoDir,
      args: ['rev-parse', '--verify', '--quiet', '--end-of-options', `${fullName}^{commit}`]
    }),
    runGit({
      git,
      dir: repoDir,
      args: ['rev-parse', '--symbolic-full-name', fullName]
    })
  ])
  if (!parsed.ok) return err(parsed.error)
  if (!symbolic.ok) return err(symbolic.error)
  if (parsed.value.exitCode === 1) return err('branch-not-found')
  if (parsed.value.exitCode !== 0 || symbolic.value.exitCode !== 0) return err('git-failed')
  if (symbolic.value.stdout.toString('utf-8').trim() !== fullName) return err('branch-not-found')
  const sha = parseCommitSha(parsed.value.stdout.toString('latin1').trim())
  if (sha === undefined) return err('git-failed')
  return ok(sha)
}
