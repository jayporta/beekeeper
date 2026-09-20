/**
 * Why a filesystem read that discovery isolates to one entry (a session's
 * transcript, or its subagents) could not complete. Isolating it, rather
 * than letting it fail a whole scan, means one unreadable file or folder
 * never hides the rest of a project.
 */
export interface UnreadableError {
  /** Discriminates this error from other discovery errors. */
  readonly reason: 'unreadable'
  /**
   * The Node.js system error code that caused the read to fail (e.g.
   * `'EACCES'`). Never the error's message, which can contain filesystem
   * paths.
   */
  readonly code: string
}
