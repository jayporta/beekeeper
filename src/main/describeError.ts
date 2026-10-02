import { errorCode } from '../core/shared/errorCode'

/** A constant-style code such as `ENOENT` or `ERR_FILE_NOT_FOUND`. */
const PLAIN_CODE = /^[A-Z][A-Z0-9_]*$/

/**
 * Names an error for a log line by its code, else its class, never by its
 * message, which can hold absolute paths. A code that isn't a plain constant
 * is treated as missing, since any library can set `code` to any string.
 *
 * @param error - The caught value.
 * @returns The error's code, its class name, or `unknown error`.
 */
export function describeError(error: unknown): string {
  const code = errorCode(error)
  if (code !== undefined && PLAIN_CODE.test(code)) return code
  return error instanceof Error ? error.name : 'unknown error'
}
