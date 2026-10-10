import type { DatabaseSync } from 'node:sqlite'

/**
 * Ends a failed transaction. A rollback that fails too must not replace the
 * error that caused it, which the caller rethrows.
 *
 * @param db - The database whose transaction failed.
 */
export function rollBack(db: DatabaseSync): void {
  try {
    db.exec('ROLLBACK')
  } catch {
    // The caller rethrows the failure that made the transaction fail, which is the one worth reporting.
  }
}
