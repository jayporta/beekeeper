import type { IpcResult } from '../../shared/ipc/ipcResult'
import { describeError } from '../describeError'
import { errResult } from './ipcResults'
import { toIpcErrorCode } from './toIpcErrorCode'

/** Options for {@link guardIpc}. */
export interface GuardIpcOptions<E, T> {
  /** Decides whether the sender may call at all. */
  readonly isTrusted: (event: E) => boolean
  /** Runs the call for a trusted sender. It receives the payload unvalidated. */
  readonly handle: (payload: unknown) => Promise<IpcResult<T>>
  /** Receives the one-line log of an internal failure. Defaults to `console.error`. */
  readonly log?: (line: string) => void
}

/**
 * Wraps a handler so an untrusted sender is refused and anything thrown,
 * including by the sender check itself, becomes a code-only error. Electron
 * forwards a thrown error's message to the renderer, so nothing may escape
 * as a throw. An `internal` failure logs one fixed line that names the error
 * by code or class, never by message, since a message can hold paths or
 * transcript text. Other codes are expected outcomes and log nothing.
 *
 * @param options - The sender check, the handler, and an optional logger.
 * @returns A listener for `ipcMain.handle`.
 */
export function guardIpc<E, T>(
  options: GuardIpcOptions<E, T>
): (event: E, payload?: unknown) => Promise<IpcResult<T>> {
  const { log = console.error } = options
  return async (event, payload) => {
    try {
      if (!options.isTrusted(event)) return errResult('untrusted-sender')
      return await options.handle(payload)
    } catch (error) {
      const code = toIpcErrorCode(error)
      if (code === 'internal') {
        log(`Beekeeper hit an internal error handling an IPC call (${describeError(error)}).`)
      }
      return errResult(code)
    }
  }
}
