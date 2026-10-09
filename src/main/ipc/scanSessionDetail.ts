import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import type { FoundSession } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { mapSessionScan } from './mapSessionScan'
import { readWorkflowRuns } from './readWorkflowRuns'
import { scanFoundSession } from './scanFoundSession'
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

/**
 * Scans a listed session in full and maps it to its detail. The scan is
 * shared and cached as {@link scanFoundSession} describes. Run records are
 * read on every call, outside the cached scan, so a run that finishes after
 * the scan was cached still shows its final record. An unreadable subagents
 * folder comes back inside the detail as `subagents: { ok: false }`.
 *
 * @param options - The dependencies and the listed session.
 * @returns The session detail.
 */
export async function scanSessionDetail(
  options: ScanSessionDetailOptions
): Promise<SessionDetailDto> {
  const { deps, sessionId, found, transcript } = options
  const scan = await scanFoundSession({ deps, found, transcript })
  const { subagents } = found.session
  const subagentsError = subagents.ok ? null : toIpcErrorCode(subagents.error)
  const workflowRuns = subagents.ok
    ? await readWorkflowRuns(found.session.sessionDir, subagents.value)
    : []
  return mapSessionScan({ sessionId, scan, subagentsError, workflowRuns })
}
