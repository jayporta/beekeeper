import type { ZodType } from 'zod'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { errResult } from '../../service/ipcResults'

/** Options for {@link parseThen}. */
export interface ParseThenOptions<R, T> {
  /** The channel's request schema from `src/shared/ipc/requestSchemas`. */
  readonly schema: ZodType<R>
  /** Runs the call with the parsed request. */
  readonly run: (request: R) => Promise<IpcResult<T>>
}

/**
 * Parses a renderer payload with its channel's schema and runs the call on success.
 * @param options - The schema and the call.
 * @returns A handler that answers `invalid-request` for a payload the schema rejects.
 */
export function parseThen<R, T>(
  options: ParseThenOptions<R, T>
): (payload: unknown) => Promise<IpcResult<T>> {
  return async (payload) => {
    const request = options.schema.safeParse(payload)
    return request.success ? options.run(request.data) : errResult('invalid-request')
  }
}
