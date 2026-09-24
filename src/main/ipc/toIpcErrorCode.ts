import { errorCode } from '../../core/transcript/errorCode'
import type { IpcErrorCode } from '../../shared/ipc/ipcResult'

/**
 * Reduces anything thrown to a code the renderer may see. The error's
 * message and stack are never read, since Node fs messages hold absolute
 * paths and other errors may hold transcript text.
 *
 * @param error - The value caught from a failed handler.
 * @returns `not-found` for a missing entry, `unreadable` for a permission
 * failure, and `internal` for everything else.
 */
export function toIpcErrorCode(error: unknown): IpcErrorCode {
  const code = errorCode(error)
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'not-found'
  if (code === 'EACCES' || code === 'EPERM') return 'unreadable'
  return 'internal'
}
