import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { OtelReceiverDto } from '../../shared/ipc/otelReceiverDto'
import { setOtelReceiverEnabledRequestSchema } from '../../shared/ipc/requestSchemas'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'

/**
 * Turns the opt-in telemetry receiver on or off.
 *
 * @param deps - The telemetry receiver, which is `null` when the app didn't set one up.
 * @param payload - The renderer's payload, validated here.
 * @returns The receiver afterwards, `invalid-request` for a bad payload, or
 * `internal` when there is no receiver. A setting that can't be saved rejects,
 * and `guardIpc` turns the rejection into a code-only error.
 */
export async function setOtelReceiverEnabledHandler(
  deps: Pick<IpcDeps, 'otel'>,
  payload: unknown
): Promise<IpcResult<OtelReceiverDto>> {
  const request = setOtelReceiverEnabledRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')
  if (deps.otel === null) return errResult('internal')
  return okResult(await deps.otel.receiver.setEnabled(request.data.enabled))
}
