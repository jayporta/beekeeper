/** A log function that keeps the lines it receives, for tests. */
export interface CollectedLog {
  /** The lines logged so far, in order. */
  readonly lines: string[]
  /** Receives a log line. */
  readonly log: (line: string) => void
}

/**
 * Builds a log function that records what it is given.
 *
 * @returns The lines and the function that appends to them.
 */
export function collectLog(): CollectedLog {
  const lines: string[] = []
  return { lines, log: (line) => lines.push(line) }
}
