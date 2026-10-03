import { errorCode } from '../../core/shared/errorCode'
import type { IpcErrorCode } from '../../shared/ipc/ipcResult'
import { describeError } from '../describeError'

/**
 * Reduces anything thrown to a code the renderer may see. The error's
 * message and stack are never read, since Node fs messages hold absolute
 * paths and other errors may hold transcript text. This is the one place an
 * `internal` failure is logged: one fixed line that names the error by code
 * or class, never by message. Other codes are expected outcomes and log
 * nothing.
 *
 * @param error - The value caught from a failed handler.
 * @param log - Receives the one-line log of an `internal` failure. Defaults to `console.error`.
 * @returns `not-found` for a missing entry, `unreadable` for a permission
 * failure, and `internal` for everything else.
 */
export function toIpcErrorCode(
  error: unknown,
  log: (line: string) => void = console.error
): IpcErrorCode {
  const code = errorCode(error)
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'not-found'
  if (code === 'EACCES' || code === 'EPERM') return 'unreadable'
  log(`Beekeeper hit an internal error handling an IPC call (${describeError(error)}).`)
  return 'internal'
}
