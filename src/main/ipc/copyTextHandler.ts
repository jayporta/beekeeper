import type { IpcResult } from '../../shared/ipc/ipcResult'
import { copyTextRequestSchema } from '../../shared/ipc/requestSchemas'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'

/**
 * Copies text to the system clipboard for the renderer, whose own clipboard
 * access is denied. The text is never logged.
 *
 * @param deps - The clipboard writer, which is `null` when the app didn't set one up.
 * @param payload - The renderer's payload, validated here.
 * @returns `null` once copied, `invalid-request` for a bad payload or text
 * over the cap, or `internal` when there is no clipboard writer.
 */
export async function copyTextHandler(
  deps: Pick<IpcDeps, 'copyToClipboard'>,
  payload: unknown
): Promise<IpcResult<null>> {
  const request = copyTextRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')
  if (deps.copyToClipboard === null) return errResult('internal')
  deps.copyToClipboard(request.data.text)
  return okResult(null)
}
