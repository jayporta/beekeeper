import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { OtelReceiverDto } from '../../shared/ipc/otelReceiverDto'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'

/**
 * Reads the opt-in telemetry receiver's state.
 *
 * @param deps - The telemetry receiver, which is `null` when the app didn't set one up.
 * @returns The receiver's state, or an off receiver when there is none.
 */
export async function getOtelReceiverHandler(
  deps: Pick<IpcDeps, 'otel'>
): Promise<IpcResult<OtelReceiverDto>> {
  if (deps.otel === null) {
    return okResult({ enabled: false, status: 'off', failure: null })
  }
  return okResult(await deps.otel.receiver.get())
}
