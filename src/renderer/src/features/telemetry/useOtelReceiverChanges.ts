import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { OTEL_RECEIVER_QUERY_KEY } from './otelReceiverQueryKey'

/**
 * Reads the telemetry receiver's state again whenever the main process says it changed on its own,
 * such as when the server fails after it started listening. The reported-cost queries follow,
 * since they poll only while the receiver is listening. Mount it once.
 */
export function useOtelReceiverChanges(): void {
  const client = useQueryClient()
  useEffect(
    () =>
      window.beekeeper.onOtelReceiverChanged(() => {
        void client.invalidateQueries({ queryKey: OTEL_RECEIVER_QUERY_KEY })
      }),
    [client]
  )
}
