import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { err, ok, type Result } from '../transcript/result'
import { assertAllowedGitArgs } from './gitAllowlist'
import { GIT_ENV } from './gitEnv'
import { isAbsoluteDir } from './gitPath'
import type { GitBinary } from './gitBinary'

const execFileAsync = promisify(execFile)

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024
const MAX_BUFFER_CODE = 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
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

/** The subset of `execFile`'s buffer-mode options that {@link runGit} sets. */
export interface GitExecOptions {
  /** Environment for the child process. */
  readonly env: Readonly<Record<string, string>>
  /** Milliseconds before the child is killed. */
  readonly timeout: number
  /** Largest stdout or stderr, in bytes, before the child is killed. */
  readonly maxBuffer: number
  /** Always `'buffer'`, so paths that aren't UTF-8 survive. */
  readonly encoding: 'buffer'
}

/** Runs a program and resolves to its raw stdout, rejecting like `execFile` does. */
export type GitExecFn = (
  file: string,
  args: readonly string[],
  options: GitExecOptions
) => Promise<{ stdout: Buffer }>

/** Why {@link runGit} could not produce output. */
export type GitRunError = 'output-too-large' | 'timeout' | 'spawn-failed'

/** A finished git process. */
export interface GitOutput {
  /** The process exit code. Zero means success. */
  readonly exitCode: number
  /** Raw stdout bytes. */
  readonly stdout: Buffer
}

/** Options for {@link runGit}. */
export interface RunGitOptions {
  /** The verified git executable. */
  readonly git: GitBinary
  /** Directory git runs in, passed as `-C`. */
  readonly dir: string
  /** The subcommand followed by its arguments. The subcommand must be allowlisted. */
  readonly args: readonly string[]
  /** Replaces the real `execFile`, for tests. */
  readonly exec?: GitExecFn
  /** Milliseconds before the child is killed. Defaults to 30 seconds. */
  readonly timeoutMs?: number
  /** Largest output in bytes. Defaults to 16 MiB. */
  readonly maxBuffer?: number
}

const defaultExec: GitExecFn = async (file, args, options) => {
  const { stdout } = await execFileAsync(file, [...args], {
    env: { ...options.env },
    timeout: options.timeout,
    maxBuffer: options.maxBuffer,
    encoding: options.encoding
  })
  return { stdout }
}

function readProp(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null || !(key in value)) return undefined
  return (value as Record<string, unknown>)[key]
}

function classifyFailure(error: unknown): Result<GitOutput, GitRunError> {
  const code = readProp(error, 'code')
  if (code === MAX_BUFFER_CODE) return err('output-too-large')
  if (typeof code === 'number') {
    const stdout = readProp(error, 'stdout')
    return ok({ exitCode: code, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.alloc(0) })
  }
  return err(readProp(error, 'killed') === true ? 'timeout' : 'spawn-failed')
}

/**
 * Runs one allowlisted, read-only git subcommand with a scrubbed environment.
 *
 * @remarks
 * Runs `git --no-lazy-fetch <pinned -c settings> -C <dir> <args>` through `execFile`, so
 * no shell is involved. A non-zero exit is a normal outcome (for example
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
  if (!isAbsoluteDir(options.dir)) throw new Error('git-dir-not-absolute')
  const exec = options.exec ?? defaultExec
  const args = [...GLOBAL_ARGS, '-C', options.dir, ...options.args]
  try {
    const { stdout } = await exec(options.git, args, {
      env: GIT_ENV,
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER,
      encoding: 'buffer'
    })
    return ok({ exitCode: 0, stdout })
  } catch (error) {
    return classifyFailure(error)
  }
}
