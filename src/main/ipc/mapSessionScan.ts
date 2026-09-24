import { compareCodeUnits } from '../../core/transcript/compareCodeUnits'
import type { SessionScan } from '../../core/session/scanSession'
import type { IpcErrorCode } from '../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
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
}

/**
 * Maps a full session scan onto its transfer shape: Maps become arrays
 * sorted by agent id, an unreadable subagent becomes a code-only error, and
 * an unlistable subagents folder becomes a code-only error for the whole list.
 *
 * @param options - The scan and what is known about the subagents folder.
 * @returns The session detail.
 */
export function mapSessionScan(options: MapSessionScanOptions): SessionDetailDto {
  const { sessionId, scan, subagentsError } = options
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
    reconciliation: mapReconciliation(scan.reconciliation)
  }
}
