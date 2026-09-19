import { errorCode } from './errorCode'
import { err, ok, type Result } from './result'
import type { UnreadableError } from './unreadableError'

/**
 * Runs `operation`, converting a system (filesystem) error it throws into a
 * {@link Result} instead of letting it propagate. Lets a caller isolate one
 * entry's read failure (for example, one session's transcript or its
 * subagents) without failing a whole scan.
 *
 * @param operation - The async operation to run.
 * @returns `ok` with `operation`'s resolved value, or `err` when it threw
 * an error carrying a system error code; the error carries only that code,
 * never the message, since a filesystem error's message can contain paths.
 * @throws {Error} When `operation` throws an error with no error code, or
 * one of Node's own `ERR_*` programmer errors, since those indicate a bug
 * rather than an expected environmental failure.
 */
export async function captureSystemError<T>(
  operation: () => Promise<T>
): Promise<Result<T, UnreadableError>> {
  try {
    return ok(await operation())
  } catch (error) {
    const code = errorCode(error)
    if (code === undefined || code.startsWith('ERR_')) throw error
    return err({ reason: 'unreadable', code })
  }
}
