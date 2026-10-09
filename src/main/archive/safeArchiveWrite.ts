import { describeArchiveError } from './describeArchiveError'

/** The failures already logged by this process, so a repeating one doesn't flood the log. */
const loggedFailures = new Set<string>()

/**
 * Runs an archive write so that it can never fail the request that triggered
 * it. A failure is logged once per kind for the process, by its code and never
 * its message. A locked database is logged as a skipped write.
 *
 * @param write - The archive write.
 * @param log - Receives the one-line log. Defaults to `console.warn`.
 */
export function safeArchiveWrite(
  write: () => void,
  log: (line: string) => void = console.warn
): void {
  try {
    write()
  } catch (error) {
    const failure = describeArchiveError(error)
    if (loggedFailures.has(failure)) return
    loggedFailures.add(failure)
    log(
      failure === 'SQLITE_BUSY'
        ? `Beekeeper archive write skipped (${failure}).`
        : `Beekeeper archive write failed (${failure}).`
    )
  }
}
