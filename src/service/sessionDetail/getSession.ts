import type { IpcResult } from '../../shared/ipc/ipcResult'
import type { GetSessionRequest } from '../../shared/ipc/requestSchemas'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import { archiveSessionDetail } from './archiveSessionDetail'
import { lookupRequestedSession } from './findRequestedSession'
import type { ServiceDeps } from '../serviceDeps'
import { errResult, okResult } from '../ipcResults'
import { readArchivedSessionDetail } from './readArchivedSessionDetail'
import { scanSessionDetail } from './scanSessionDetail'

/**
 * Scans one session in full. Calls for the same session state (same lead
 * and subagent files) share one scan or its cached result, and the scheduler
 * caps how many sessions scan at once.
 *
 * @param deps - The projects root, the scan scheduler, the scan cache, the archive, and the clock.
 * @param request - A request parsed by `getSessionRequestSchema`, which keeps
 * its folder name and session id path-free.
 * @returns The session detail, or
 * `not-found` when the project isn't in a fresh listing, or the session isn't
 * and has no archived detail. A session missing from a listed project comes
 * back from the archive, marked archived, when one has its detail; a live
 * session is never replaced by its archived copy, and an unreadable
 * transcript never falls back. A
 * transcript that vanishes mid-scan rejects, and `guardIpc` turns the
 * rejection into a code-only error. An unreadable subagents folder comes back
 * inside the detail as `subagents: { ok: false }`. A run's record is read on
 * every call, never cached, and a run whose record can't be used comes back
 * with `record: null`. A session quiet for the archive's waiting period has
 * its detail archived, and the archive never throws, so a failing archive write never changes the result.
 */
export async function getSession(
  deps: Pick<
    ServiceDeps,
    'projectsRoot' | 'scans' | 'scanCache' | 'agentScans' | 'archive' | 'now'
  >,
  request: GetSessionRequest
): Promise<IpcResult<SessionDetailDto>> {
  const lookup = await lookupRequestedSession(deps, request)
  if (lookup.kind === 'error') return errResult(lookup.code)
  if (lookup.kind === 'session-missing') {
    const archived = readArchivedSessionDetail({ archive: deps.archive, ref: lookup.ref })
    return archived === null ? errResult('not-found') : okResult(archived)
  }

  const { projectDirName, sessionId, found, transcript } = lookup.session
  const { detail, complete } = await scanSessionDetail({ deps, sessionId, found, transcript })
  archiveSessionDetail({ deps, projectDirName, detail, complete, transcript })
  return okResult(detail)
}
