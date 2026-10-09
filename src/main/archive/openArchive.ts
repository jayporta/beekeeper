import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describeArchiveError } from './describeArchiveError'
import { applySchema } from './archiveSchema'

/** The open archive database. */
export type ArchiveDb = DatabaseSync

const IN_MEMORY = ':memory:'

/**
 * Opens or creates the archive database and applies its schema. The archive
 * is optional: a file that is corrupt, locked, written by a newer version, or
 * in a folder that can't be created leaves the app running without it.
 *
 * @param path - The database file, or `:memory:` for tests. A missing parent
 * folder is created.
 * @param log - Receives the one-line failure log, which carries an error code
 * and never a path. Defaults to `console.warn`.
 * @returns The ready database, or `null` when it can't be used.
 */
export function openArchive(
  path: string,
  log: (line: string) => void = console.warn
): ArchiveDb | null {
  let db: ArchiveDb | null = null
  try {
    if (path !== IN_MEMORY) mkdirSync(dirname(path), { recursive: true })
    db = new DatabaseSync(path)
    const schema = applySchema(db)
    if (schema.ok) return db
    log(`Beekeeper archive is disabled (${schema.error}).`)
  } catch (error) {
    log(`Beekeeper archive is disabled (${describeArchiveError(error)}).`)
  }
  closeDiscarded(db, log)
  return null
}

/**
 * Closes a database that can't be used, logging a failure to close by its code.
 *
 * @param db - The database being discarded, or `null` when none was opened.
 * @param log - Receives the one-line log.
 */
export function closeDiscarded(db: ArchiveDb | null, log: (line: string) => void): void {
  try {
    db?.close()
  } catch (error) {
    log(`Beekeeper archive could not be closed (${describeArchiveError(error)}).`)
  }
}
