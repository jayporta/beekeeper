import { errorCode } from '../../core/shared/errorCode'

const CODE_IN_MESSAGE = /\bE[A-Z]{2,}\b/

/**
 * Builds the error a {@link FileSystemPort} method rejects with: a Node-style `code` and nothing else.
 *
 * @param code - The error code, such as `ENOENT`.
 * @param message - Fixed text with no path or engine output in it; defaults to the code.
 * @returns A new `Error` carrying the code.
 */
export function portError(code: string, message: string = code): Error {
  return Object.assign(new Error(message), { code })
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

/**
 * Awaits an engine call, rejecting with {@link toPortError}'s error in place of the engine's.
 *
 * @param call - The pending engine call.
 * @returns What the call resolves with.
 * @throws {Error} A port error carrying the engine rejection's code.
 */
export async function withPortError<T>(call: Promise<T>): Promise<T> {
  try {
    return await call
  } catch (error) {
    throw toPortError(error)
  }
}
