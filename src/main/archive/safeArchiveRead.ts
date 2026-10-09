import { describeArchiveError } from './describeArchiveError'

/** The failures already logged by this process, so a repeating one doesn't flood the log. */
const loggedFailures = new Set<string>()

/**
 * Runs an archive read so that it can never fail the request that triggered
 * it. A failure is logged once per kind for the process, by its code and never
 * its message, and the read answers with the fallback.
 *
 * @param read - The archive read.
 * @param fallback - What to answer when the read fails.
 * @param log - Receives the one-line log. Defaults to `console.warn`.
 * @returns What the read returned, or the fallback.
 */
export function safeArchiveRead<T>(
  read: () => T,
  fallback: T,
  log: (line: string) => void = console.warn
): T {
  try {
    return read()
  } catch (error) {
    const failure = describeArchiveError(error)
    if (!loggedFailures.has(failure)) {
      loggedFailures.add(failure)
      log(`Beekeeper archive read failed (${failure}).`)
    }
    return fallback
  }
}
