import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { OtelReceiverDto } from '../../../../shared/ipc/otelReceiverDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { OTEL_RECEIVER_QUERY_KEY } from './otelReceiverQueryKey'

/**
 * Loads the opt-in telemetry receiver's state. It never goes stale and is not
 * polled: reading it opens the settings file, so it is read once and then
 * replaced by `useSetOtelReceiverEnabled` when the person changes it, and read
 * again by `useOtelReceiverChanges` when the main process says it changed on
 * its own. A failed call surfaces as an `IpcCallError` on the query's `error`.
 *
 * @returns The receiver query.
 */
export function useOtelReceiver(): UseQueryResult<OtelReceiverDto> {
  return useQuery({
    queryKey: OTEL_RECEIVER_QUERY_KEY,
    queryFn: async () => unwrapIpcResult(await window.beekeeper.getOtelReceiver()),
    staleTime: Infinity
  })
}
