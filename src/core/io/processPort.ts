import type { Result } from '../shared/result'

/** Why a program produced no output. */
export type ProcessRunError = 'output-too-large' | 'timeout' | 'spawn-failed'

/** One program run. */
export interface ProcessRequest {
  /** Absolute path of the program; never looked up on `PATH`. */
  readonly file: string
  /** Arguments after the program, passed without a shell. */
  readonly args: readonly string[]
  /** The child's complete environment; nothing is inherited. */
  readonly env: Readonly<Record<string, string>>
  /** Milliseconds before the child is killed and the run reports `timeout`. */
  readonly timeoutMs: number
  /** Largest stdout or stderr, in bytes, before the child is killed and the run reports `output-too-large`. */
  readonly maxOutputBytes: number
}

/** A program that ran to exit. */
export interface ProcessOutput {
  /** The exit code; zero means success. A non-zero exit is an outcome, not an error. */
  readonly exitCode: number
  /** The child's stdout. */
  readonly stdout: Uint8Array
  /** Whether this run's `stdout` is the child's exact bytes; overrides the port's `exactOutput` when set. */
  readonly exact?: boolean
}

/**
 * Everything core runs as a child process.
 *
 * @remarks
 * Every adapter must: run `file` by absolute path with no shell and no `PATH`
 * lookup; give the child exactly `env` and nothing inherited; kill the child
 * at `timeoutMs` and report `timeout`; report `output-too-large` past
 * `maxOutputBytes` or past its own lower ceiling; and report a non-zero exit as
 * `exitCode`, not as an error.
 */
export interface ProcessPort {
  /**
   * Runs one program to exit.
   * @param request - The program, its arguments, environment and limits.
   * @returns The exit code and stdout, or why no output is available.
   */
  run(request: ProcessRequest): Promise<Result<ProcessOutput, ProcessRunError>>
  /**
   * Whether `path` is an executable file.
   * @param path - An absolute path.
   * @returns `false` on any failure.
   */
  isExecutable(path: string): Promise<boolean>
  /** The host platform, as Node names it (`darwin`, `linux`, ...). */
  readonly platform: string
  /** Whether `stdout` is the child's exact bytes by default; `false` for an adapter that only gets text. A run's own `exact` overrides it. */
  readonly exactOutput: boolean
}
