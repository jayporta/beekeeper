import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ReportedCostDto } from '../../../../shared/ipc/reportedCostDto'
import { unwrapIpcResult } from '@renderer/ipc/unwrapIpcResult'
import { useOtelReceiver } from './useOtelReceiver'

/** How often a listening receiver's figures are read again, in milliseconds. It is a local IPC call. */
export const REPORTED_COST_POLL_MS = 5000

/**
 * Loads what Claude Code's telemetry reported for one session. It reads only
 * while the receiver is listening, and then again every
 * {@link REPORTED_COST_POLL_MS}, since reports arrive as Claude Code works. The
 * result is not persisted.
 *
 * @param sessionId - The session to look up.
 * @returns The query. Its data is `null` when the session reported nothing, and `undefined` while the receiver is not listening.
 */
export function useReportedCost(sessionId: string): UseQueryResult<ReportedCostDto | null> {
  const { data: receiver } = useOtelReceiver()
  return useQuery({
    queryKey: ['reportedCost', sessionId],
    queryFn: async () => unwrapIpcResult(await window.beekeeper.getReportedCost(sessionId)),
    enabled: receiver?.status === 'listening',
    refetchInterval: REPORTED_COST_POLL_MS
  })
}
