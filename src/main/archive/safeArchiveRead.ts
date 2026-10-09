import { guardArchiveCall } from './guardArchiveCall'

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
  return guardArchiveCall({ run: read, fallback, kind: 'read', log })
}
