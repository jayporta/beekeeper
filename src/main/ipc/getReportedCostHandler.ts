import type { IpcResult } from '../../shared/ipc/ipcResult'
import { getReportedCostRequestSchema } from '../../shared/ipc/requestSchemas'
import type { ReportedCostDto } from '../../shared/ipc/reportedCostDto'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'

/**
 * Reads what Claude Code's telemetry reported for one session.
 *
 * @param deps - The telemetry receiver, which is `null` when the app didn't set one up.
 * @param payload - The renderer's payload, validated here.
 * @returns The reported cost, `null` when the session reported nothing or
 * there is no receiver, or `invalid-request` for a bad payload.
 */
export async function getReportedCostHandler(
  deps: Pick<IpcDeps, 'otel'>,
  payload: unknown
): Promise<IpcResult<ReportedCostDto | null>> {
  const request = getReportedCostRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')
  return okResult(deps.otel?.costs.get(request.data.sessionId) ?? null)
}
