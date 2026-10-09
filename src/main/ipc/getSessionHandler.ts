import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import { archiveSessionDetail } from './archiveSessionDetail'
import { findRequestedSession } from './findRequestedSession'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'
import { scanSessionDetail } from './scanSessionDetail'

/**
 * Scans one session in full. Calls for the same session state (same lead
 * and subagent files) share one scan or its cached result, and the scheduler
 * caps how many sessions scan at once.
 *
 * @param deps - The projects root, the scan scheduler, the scan cache, the archive, and the clock.
 * @param payload - The renderer's payload, validated here.
 * @returns The session detail, `invalid-request` for a bad payload, or
 * `not-found` when the project or session isn't in a fresh listing. A
 * transcript that vanishes mid-scan rejects, and `guardIpc` turns the
 * rejection into a code-only error. An unreadable subagents folder comes back
 * inside the detail as `subagents: { ok: false }`. A run's record is read on
 * every call, never cached, and a run whose record can't be used comes back
 * with `record: null`. A session quiet for the archive's waiting period has
 * its detail archived, and a failing archive write never changes the result.
 */
export async function getSessionHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'scans' | 'scanCache' | 'archive' | 'now'>,
  payload: unknown
): Promise<IpcResult<SessionDetailDto>> {
  const requested = await findRequestedSession(deps, payload)
  if (!requested.ok) return requested

  const { projectDirName, sessionId, found, transcript } = requested.value
  const detail = await scanSessionDetail({ deps, sessionId, found, transcript })
  archiveSessionDetail({ deps, projectDirName, detail, transcript })
  return okResult(detail)
}
