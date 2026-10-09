import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { FoundSession } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { mapSessionScan } from './mapSessionScan'
import { readWorkflowRuns } from './readWorkflowRuns'
import { scanFoundSession } from './scanFoundSession'
import { isCompleteScan } from './sessionScanCache'
import { toIpcErrorCode } from './toIpcErrorCode'

/** Options for {@link scanSessionDetail}. */
export interface ScanSessionDetailOptions {
  /** The scan scheduler and the scan cache. */
  readonly deps: Pick<IpcDeps, 'scans' | 'scanCache'>
  /** The session's id. */
  readonly sessionId: string
  /** The session from a fresh listing. */
  readonly found: FoundSession
  /** The session's transcript, already checked readable. */
  readonly transcript: TranscriptFileInfo
}

/** A session scanned in full. */
export interface ScannedSessionDetail {
  /** The session's detail. */
  readonly detail: SessionDetailDto
  /**
   * Whether the scan read everything it needed: no unreadable subagent
   * transcript or meta file, and a subagents folder that could be listed. An
   * incomplete scan may read differently once the failure clears, so it is
   * never archived.
   */
  readonly complete: boolean
}

/**
 * Scans a listed session in full and maps it to its detail. The scan is
 * shared and cached as {@link scanFoundSession} describes. Run records are
 * read on every call, outside the cached scan, so a run that finishes after
 * the scan was cached still shows its final record. An unreadable subagents
 * folder comes back inside the detail as `subagents: { ok: false }`.
 *
 * @param options - The dependencies and the listed session.
 * @returns The session detail, and whether the scan was complete.
 */
export async function scanSessionDetail(
  options: ScanSessionDetailOptions
): Promise<ScannedSessionDetail> {
  const { deps, sessionId, found, transcript } = options
  const scan = await scanFoundSession({ deps, found, transcript })
  const { subagents } = found.session
  const subagentsError = subagents.ok ? null : toIpcErrorCode(subagents.error)
  const workflowRuns = subagents.ok
    ? await readWorkflowRuns(found.session.sessionDir, subagents.value)
    : []
  return {
    detail: mapSessionScan({ sessionId, scan, subagentsError, workflowRuns }),
    complete: isCompleteScan(scan, subagents.ok)
  }
}
