import { describeError } from '../describeError'

/** SQLite's primary result code for a locked database. */
const SQLITE_BUSY = 5

/** The bits of an extended result code that hold the primary code. */
const PRIMARY_CODE_MASK = 0xff

/**
 * Names an archive failure for a log line, never by its message, which can
 * hold the database path. `node:sqlite` gives every SQLite failure the code
 * `ERR_SQLITE_ERROR`, so the result code tells them apart.
 *
 * @param error - The caught value.
 * @returns `SQLITE_BUSY` for a locked database, the error's name and primary
 * result code for another SQLite failure, else the name {@link describeError} gives it.
 */
export function describeArchiveError(error: unknown): string {
  const name = describeError(error)
  if (typeof error !== 'object' || error === null || !('errcode' in error)) return name
  const { errcode } = error
  if (typeof errcode !== 'number') return name
  const primary = errcode & PRIMARY_CODE_MASK
  return primary === SQLITE_BUSY ? 'SQLITE_BUSY' : `${name} (result ${primary})`
}
