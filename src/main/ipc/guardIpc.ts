import type { IpcResult } from '../../shared/ipc/ipcResult'
import { errResult } from './ipcResults'
import { toIpcErrorCode } from './toIpcErrorCode'

/** Options for {@link guardIpc}. */
export interface GuardIpcOptions<E, T> {
  /** Decides whether the sender may call at all. */
  readonly isTrusted: (event: E) => boolean
  /** Runs the call for a trusted sender. It receives the payload unvalidated. */
  readonly handle: (payload: unknown) => Promise<IpcResult<T>>
}

/**
 * Wraps a handler so an untrusted sender is refused and anything thrown,
 * including by the sender check itself, becomes a code-only error. Electron
 * forwards a thrown error's message to the renderer, so nothing may escape
 * as a throw. Nothing is logged, since an error's message can hold paths or
 * transcript text.
 *
 * @param options - The sender check and the handler.
 * @returns A listener for `ipcMain.handle`.
 */
export function guardIpc<E, T>(
  options: GuardIpcOptions<E, T>
): (event: E, payload?: unknown) => Promise<IpcResult<T>> {
  return async (event, payload) => {
    try {
      if (!options.isTrusted(event)) return errResult('untrusted-sender')
      return await options.handle(payload)
    } catch (error) {
      return errResult(toIpcErrorCode(error))
    }
  }
}
