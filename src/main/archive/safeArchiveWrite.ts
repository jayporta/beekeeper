import { guardArchiveCall } from './guardArchiveCall'

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
  guardArchiveCall({ run: write, fallback: undefined, kind: 'write', log })
}
