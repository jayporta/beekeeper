import { errorCode } from './errorCode'

/**
 * Reports whether a caught, unknown error is a Node.js filesystem error for
 * an entry that does not exist or is not a directory: `ENOENT` or
 * `ENOTDIR`. Discovery treats both as "nothing to find here" rather than a
 * failure, since a project or session directory can disappear between a
 * listing and a stat.
 *
 * @param error - The value caught from a failed filesystem call.
 * @returns `true` when `error` is a Node error with code `ENOENT` or `ENOTDIR`.
 */
export function isMissingEntryError(error: unknown): boolean {
  const code = errorCode(error)
  return code === 'ENOENT' || code === 'ENOTDIR'
}
