import type { IpcErrorCode } from '../../../shared/ipc/ipcResult'

/**
 * The error a failed IPC call becomes in the renderer. It carries only the
 * code, since the bridge never sends a message and a message could hold
 * paths or transcript text.
 */
export class IpcCallError extends Error {
  /** Why the call failed. */
  readonly code: IpcErrorCode

  constructor(code: IpcErrorCode) {
    super(code)
    this.name = 'IpcCallError'
    this.code = code
  }

  /**
   * Reads the code off a caught value.
   * @param error - Whatever a query or call threw.
   * @returns The error's code, or `'internal'` when it isn't an {@link IpcCallError}.
   */
  static codeOf(error: unknown): IpcErrorCode {
    return error instanceof IpcCallError ? error.code : 'internal'
  }
}
