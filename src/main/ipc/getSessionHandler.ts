import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import { findRequestedSession } from './findRequestedSession'
import type { IpcDeps } from './ipcDeps'
import { okResult } from './ipcResults'
import { mapSessionScan } from './mapSessionScan'
import { scanFoundSession } from './scanFoundSession'
import { toIpcErrorCode } from './toIpcErrorCode'

/**
 * Scans one session in full. Calls for the same session state (same lead
 * and subagent files) share one scan or its cached result, and the scheduler
 * caps how many sessions scan at once.
 *
 * @param deps - The projects root, the scan scheduler, and the scan cache.
 * @param payload - The renderer's payload, validated here.
 * @returns The session detail, `invalid-request` for a bad payload, or
 * `not-found` when the project or session isn't in a fresh listing. A
 * transcript that vanishes mid-scan rejects, and `guardIpc` turns the
 * rejection into a code-only error. An unreadable subagents folder comes back
 * inside the detail as `subagents: { ok: false }`.
 */
export async function getSessionHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'scans' | 'scanCache'>,
  payload: unknown
): Promise<IpcResult<SessionDetailDto>> {
  const requested = await findRequestedSession(deps, payload)
  if (!requested.ok) return requested

  const { sessionId, found, transcript } = requested.value
  const scan = await scanFoundSession({ deps, found, transcript })
  const { subagents } = found.session
  const subagentsError = subagents.ok ? null : toIpcErrorCode(subagents.error)
  return okResult(mapSessionScan({ sessionId, scan, subagentsError }))
}
