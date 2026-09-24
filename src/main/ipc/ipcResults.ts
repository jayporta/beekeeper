import type { IpcErrorCode, IpcResult } from '../../shared/ipc/ipcResult'

/**
 * Wraps a value as a successful IPC result.
 * @param value - The value to send to the renderer.
 * @returns A successful result.
 */
export function okResult<T>(value: T): IpcResult<T> {
  return { ok: true, value }
}

/**
 * Builds a failed IPC result carrying only a code.
 * @param code - Why the call failed.
 * @returns A failed result.
 */
export function errResult(code: IpcErrorCode): IpcResult<never> {
  return { ok: false, error: { code } }
}
