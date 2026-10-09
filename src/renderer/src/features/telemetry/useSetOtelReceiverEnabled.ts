import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { OtelReceiverDto } from '../../../../shared/ipc/otelReceiverDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { OTEL_RECEIVER_QUERY_KEY } from './otelReceiverQueryKey'

/**
 * Turns the telemetry receiver on or off. When the call succeeds, the
 * receiver's state in the cache becomes what the call returned, so everything
 * that reads it updates at once. A failed call surfaces as an `IpcCallError`
 * on the mutation's `error` and reads the receiver again, so the cache never
 * keeps a port or token the main process no longer holds.
 *
 * @returns The mutation, called with the new setting.
 */
export function useSetOtelReceiverEnabled(): UseMutationResult<OtelReceiverDto, Error, boolean> {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (enabled: boolean) =>
      unwrapIpcResult(await window.beekeeper.setOtelReceiverEnabled(enabled)),
    onSuccess: (receiver) => {
      client.setQueryData(OTEL_RECEIVER_QUERY_KEY, receiver)
    },
    onError: () => client.invalidateQueries({ queryKey: OTEL_RECEIVER_QUERY_KEY })
  })
}
