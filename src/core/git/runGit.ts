import { processPort } from '../io/installProcessPort'
import type { ProcessOutput, ProcessPort, ProcessRunError } from '../io/processPort'
import { isAbsolutePath } from '../shared/absolutePath'
import type { Result } from '../shared/result'
import { assertAllowedGitArgs } from './gitAllowlist'
import { GIT_ENV } from './gitEnv'
import type { GitBinary } from './gitBinary'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024
/** Options placed before every subcommand. `--no-lazy-fetch` makes git older than 2.44 reject the command. */
const GLOBAL_ARGS = [
  '--no-lazy-fetch',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'core.attributesFile=/dev/null',
  '-c',
  'core.untrackedCache=false',
  '-c',
  'protocol.allow=never',
  ...['ext', 'file', 'ssh', 'http', 'https', 'git'].flatMap((name) => [
    '-c',
    `protocol.${name}.allow=never`
  ])
]

/** Why {@link runGit} could not produce output. */
export type GitRunError = ProcessRunError

/** A finished git process: its exit code (zero means success) and raw stdout bytes. */
export type GitOutput = ProcessOutput

/** Options for {@link runGit}. */
export interface RunGitOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** Directory git runs in, passed as `-C`. */
  readonly dir: string
  /** The subcommand followed by its arguments. The subcommand must be allowlisted. */
  readonly args: readonly string[]
  /** Replaces the installed process port, for tests. */
  readonly port?: ProcessPort
  /** Milliseconds before the child is killed. Defaults to 30 seconds. */
  readonly timeoutMs?: number
  /** Largest output in bytes. Defaults to 16 MiB. */
  readonly maxBuffer?: number
}

/**
 * Runs one allowlisted, read-only git subcommand with a scrubbed environment.
 *
 * @remarks
 * Runs `git --no-lazy-fetch <pinned -c settings> -C <dir> <args>` through the process
 * port, so no shell is involved. A non-zero exit is a normal outcome (for example
 * `merge-base` exits 1 when there is no common ancestor), so it comes back
 * as `exitCode`, not as an error.
 *
 * Read-only in effect: git never rewrites the index or hooks for these
 * commands. In a repo with a split index, git still refreshes the mtime of
 * `.git/sharedindex.*` on any read. Its contents never change.
 *
 * @param options - The binary, directory, and arguments to run.
 * @returns The exit code and stdout, or why no output is available.
 * @throws {Error} With message `git-subcommand-not-allowed` when the subcommand isn't allowlisted, `git-option-not-allowed` when an argument is a flag outside the subcommand's fixed set, or `git-dir-not-absolute` when `dir` is relative.
 */
export async function runGit(options: RunGitOptions): Promise<Result<GitOutput, GitRunError>> {
  assertAllowedGitArgs(options.args)
  if (!isAbsolutePath(options.dir)) throw new Error('git-dir-not-absolute')
  return (options.port ?? processPort()).run({
    file: options.git,
    args: [...GLOBAL_ARGS, '-C', options.dir, ...options.args],
    env: GIT_ENV,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxOutputBytes: options.maxBuffer ?? DEFAULT_MAX_BUFFER
  })
}
