import { createArchiveStore } from './createArchiveStore'
import type { ArchiveStore } from './archiveStoreTypes'
import { describeArchiveError } from './describeArchiveError'
import { closeDiscarded, openArchive } from './openArchive'

/**
 * Opens the archive and builds its store. The archive is optional: whatever
 * stops it from opening, or from preparing its statements, leaves the app
 * running without it.
 *
 * @param path - The database file.
 * @param log - Receives each one-line failure log, which carries a code and
 * never a path. Defaults to `console.warn`.
 * @returns The store, or `null` when the archive can't be used.
 */
export function openArchiveStore(
  path: string,
  log: (line: string) => void = console.warn
): ArchiveStore | null {
  const db = openArchive(path, log)
  if (db === null) return null
  try {
    return createArchiveStore(db, { log })
  } catch (error) {
    log(`Beekeeper archive is disabled (${describeArchiveError(error)}).`)
    closeDiscarded(db, log)
    return null
  }
}
