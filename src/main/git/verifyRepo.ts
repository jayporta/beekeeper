import { lstat, realpath } from 'node:fs/promises'
import type { GitBinary } from '../../core/git/gitBinary'
import { isAbsoluteDir } from '../../core/git/gitPath'
import { runGit, type GitRunError } from '../../core/git/runGit'
import { err, ok, type Result } from '../../core/transcript/result'

/** Why a directory could not be confirmed as a repository. */
export type VerifyRepoError = 'repo-missing' | 'not-a-repo' | GitRunError

/** Options for {@link verifyRepo}. */
export interface VerifyRepoOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** A directory taken from a transcript, so untrusted. */
  readonly dir: string
}

/**
 * Confirms a transcript-supplied directory is inside a git repository and
 * returns the repository's canonical top-level directory.
 *
 * @remarks
 * Resolves symlinks first, requires a directory, then asks git for
 * `--show-toplevel` and resolves that too. Only the returned path should
 * reach later git calls.
 *
 * @param options - The git binary and the directory to check.
 * @returns The real absolute top-level path, `repo-missing` when the
 * directory doesn't exist or isn't absolute, `not-a-repo` when it isn't a
 * directory in a working tree, or why git could not run.
 */
export async function verifyRepo(
  options: VerifyRepoOptions
): Promise<Result<string, VerifyRepoError>> {
  if (!isAbsoluteDir(options.dir)) return err('repo-missing')
  let real: string
  try {
    real = await realpath(options.dir)
    if (!(await lstat(real)).isDirectory()) return err('not-a-repo')
  } catch {
    return err('repo-missing')
  }

  const output = await runGit({
    git: options.git,
    dir: real,
    args: ['rev-parse', '--path-format=absolute', '--show-toplevel']
  })
  if (!output.ok) return err(output.error)
  if (output.value.exitCode !== 0) return err('not-a-repo')
  const top = output.value.stdout.toString('utf-8').trim()
  if (!isAbsoluteDir(top)) return err('not-a-repo')
  try {
    return ok(await realpath(top))
  } catch {
    return err('repo-missing')
  }
}
