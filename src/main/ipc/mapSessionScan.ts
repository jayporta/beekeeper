import type { SessionScan } from '../../core/session/scanSession'
import { compareCodeUnits } from '../../core/shared/compareCodeUnits'
import type { IpcErrorCode } from '../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { WorkflowRunDto } from '../../shared/ipc/workflowRunDto'
import { mapAgentReport } from './mapAgentReport'
import { mapAgentNode } from './mapAgentTree'
import { errResult, okResult } from './ipcResults'
import { mapReconciliation } from './mapReconciliation'
import { toIpcErrorCode } from './toIpcErrorCode'

/** Input for {@link mapSessionScan}. */
export interface MapSessionScanOptions {
  /** The scanned session's id. */
  readonly sessionId: string
  /** The core scan. */
  readonly scan: SessionScan
  /** The code for why the subagents folder could not be listed, or `null` when it was. */
  readonly subagentsError: IpcErrorCode | null
  /** The session's workflow runs with their records. */
  readonly workflowRuns: readonly WorkflowRunDto[]
}

/**
 * Maps a full session scan onto its transfer shape: Maps become arrays
 * sorted by agent id, an unreadable subagent becomes a code-only error, and
 * an unlistable subagents folder becomes a code-only error for the whole list.
 *
 * @param options - The scan, what is known about the subagents folder, and the workflow runs.
 * @returns The session detail.
 */
export function mapSessionScan(options: MapSessionScanOptions): SessionDetailDto {
  const { sessionId, scan, subagentsError, workflowRuns } = options
  const reports = [...scan.subagents]
    .sort(([a], [b]) => compareCodeUnits(a, b))
    .map(([agentId, result]) => ({
      agentId,
      report: result.ok
        ? okResult(mapAgentReport(result.value))
        : errResult(toIpcErrorCode(result.error))
    }))

  return {
    sessionId,
    tree: mapAgentNode(scan.tree),
    lead: mapAgentReport(scan.lead),
    subagents: subagentsError === null ? okResult(reports) : errResult(subagentsError),
    reconciliation: mapReconciliation(scan.reconciliation),
    workflowRuns,
    archived: false
  }
}
