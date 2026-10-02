import { errorCode } from '../core/shared/errorCode'

/** A constant-style code such as `ENOENT` or `ERR_FILE_NOT_FOUND`. */
const PLAIN_CODE = /^[A-Z][A-Z0-9_]*$/

/** A class name such as `TypeError`. */
const PLAIN_NAME = /^[A-Za-z_$][\w$]*$/

/**
 * Names an error for a log line by its code, else its class, never by its
 * message, which can hold absolute paths. A code or class name that isn't a
 * plain identifier is treated as missing, since any library can set either
 * to any string.
 *
 * @param error - The caught value.
 * @returns The error's code, its class name, or `unknown error`.
 */
export function describeError(error: unknown): string {
  const code = errorCode(error)
  if (code !== undefined && PLAIN_CODE.test(code)) return code
  if (error instanceof Error && PLAIN_NAME.test(error.name)) return error.name
  return 'unknown error'
}
