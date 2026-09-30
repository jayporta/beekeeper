import type { IpcResult } from '../../../shared/ipc/ipcResult'
import { IpcCallError } from './ipcCallError'

/**
 * Unwraps an IPC result for use as a query function's return value.
 *
 * @param result - What an IPC call resolved to.
 * @returns The successful value.
 * @throws {IpcCallError} When the call failed, carrying only its code.
 */
export function unwrapIpcResult<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new IpcCallError(result.error.code)
  return result.value
}
