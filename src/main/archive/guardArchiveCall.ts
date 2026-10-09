import { describeArchiveError } from './describeArchiveError'

/** What kind of archive call is guarded, which the log line names. */
export type ArchiveCallKind = 'read' | 'write'

/** The failures already logged by this process, by kind and code, so a repeating one doesn't flood the log. */
const loggedFailures = new Set<string>()

/** Options for {@link guardArchiveCall}. */
export interface GuardArchiveCallOptions<T> {
  /** The archive call. */
  readonly run: () => T
  /** What to answer when the call fails. */
  readonly fallback: T
  /** Whether the call reads or writes, which the log line names. */
  readonly kind: ArchiveCallKind
  /**
   * Receives the one-line log.
   * @defaultValue `console.warn`
   */
  readonly log?: (line: string) => void
}

/**
 * Runs an archive call so that it can never fail the request that triggered
 * it. A failure is logged once per kind of call and code for the process, by
 * its code and never its message. A write against a locked database is logged
 * as skipped rather than failed.
 *
 * @param options - The call, its fallback, its kind, and where to log.
 * @returns What the call returned, or the fallback when it threw.
 */
export function guardArchiveCall<T>(options: GuardArchiveCallOptions<T>): T {
  const { run, fallback, kind, log = console.warn } = options
  try {
    return run()
  } catch (error) {
    const failure = describeArchiveError(error)
    const logKey = `${kind}:${failure}`
    if (!loggedFailures.has(logKey)) {
      loggedFailures.add(logKey)
      const outcome = kind === 'write' && failure === 'SQLITE_BUSY' ? 'skipped' : 'failed'
      log(`Beekeeper archive ${kind} ${outcome} (${failure}).`)
    }
    return fallback
  }
}
