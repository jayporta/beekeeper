import { realpath } from 'node:fs/promises'
import { isAbsolutePath } from '../shared/absolutePath'
import { err, ok, type Result } from '../shared/result'
import { defaultFsRunner, isFsTimeout, type FsRunner } from './fsDeadline'
import type { GitBinary } from './gitBinary'
import { runGit, type GitRunError } from './runGit'

/** Options for {@link realCommonDir}. */
export interface RealCommonDirOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** A directory inside the repository or one of its linked worktrees. */
  readonly dir: string
  /** Runs the filesystem call under a deadline. Defaults to the app-wide runner. */
  readonly fsRunner?: FsRunner
}

/**
 * Finds the directory that identifies a repository across its linked
 * worktrees: git's `--git-common-dir`, with symlinks resolved.
 * @param options - The git binary and a directory in the repository.
 * @returns The real absolute path, `not-a-repo` when git can't name one, `timeout` when resolving it hangs past its deadline, or why git could not run.
 */
export async function realCommonDir(
  options: RealCommonDirOptions
): Promise<Result<string, 'not-a-repo' | GitRunError>> {
  const output = await runGit({
    git: options.git,
    dir: options.dir,
    args: ['rev-parse', '--path-format=absolute', '--git-common-dir']
  })
  if (!output.ok) return err(output.error)
  const path = output.value.stdout.toString('utf-8').trim()
  if (output.value.exitCode !== 0 || !isAbsolutePath(path)) return err('not-a-repo')
  try {
    return ok(await (options.fsRunner ?? defaultFsRunner)(() => realpath(path)))
  } catch (error) {
    return err(isFsTimeout(error) ? 'timeout' : 'not-a-repo')
  }
}
