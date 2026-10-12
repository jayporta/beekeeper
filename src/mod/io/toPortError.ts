import { errorCode } from '../../core/shared/errorCode'

const CODE_IN_MESSAGE = /\bE[A-Z]{2,}\b/

/**
 * Builds the error a {@link FileSystemPort} method rejects with: a Node-style `code` and nothing else.
 *
 * @param code - The error code, such as `ENOENT`.
 * @returns A new `Error` whose message is the code.
 */
export function portError(code: string): Error {
  return Object.assign(new Error(code), { code })
}

/**
 * Turns an engine rejection into the error core expects from a file system adapter.
 *
 * The result's message is the code alone, since engine messages can hold paths, and the original is
 * never kept, not even as `cause`, so nothing downstream can log its text.
 *
 * @param error - What the engine call rejected with.
 * @returns A new `Error` carrying the original's string `code`, else the first `ENOENT`-style code
 * in its message, else `EIO`.
 */
export function toPortError(error: unknown): Error {
  const message = error instanceof Error ? error.message : undefined
  return portError(errorCode(error) ?? message?.match(CODE_IN_MESSAGE)?.[0] ?? 'EIO')
}
