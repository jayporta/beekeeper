import { discoverSessions } from '../../core/transcript/discoverSessions'
import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { IpcErrorCode, IpcResult } from '../../shared/ipc/ipcResult'
import type { GetSessionRequest } from '../../shared/ipc/requestSchemas'
import type { SessionRefDto } from '../../shared/ipc/sessionRefDto'
import { findProject, type FoundSession } from '../projects/findProject'
import type { ServiceDeps } from '../serviceDeps'
import { errResult, okResult } from '../ipcResults'
import { toIpcErrorCode } from '../toIpcErrorCode'

/** A session a renderer request named, found in a fresh listing. */
export interface RequestedSession {
  /** The project folder name from the request. */
  readonly projectDirName: string
  /** The session id from the request. */
  readonly sessionId: string
  /** The listed project and session. */
  readonly found: FoundSession
  /** The session's transcript, known readable. */
  readonly transcript: TranscriptFileInfo
}

/** What looking up a requested session found. */
export type RequestedSessionLookup =
  | { readonly kind: 'found'; readonly session: RequestedSession }
  /** The request's project is listed, but the project has no such session. */
  | { readonly kind: 'session-missing'; readonly ref: SessionRefDto }
  | { readonly kind: 'error'; readonly code: IpcErrorCode }

/**
 * Looks a requested session up in fresh listings, telling a session missing
 * from a listed project apart from every other failure.
 *
 * @param deps - The projects root.
 * @param request - A request parsed by `getSessionRequestSchema`, which keeps
 * its folder name and session id path-free.
 * @returns The session; `session-missing` with the request when the project
 * is listed but the session isn't; or an error with `not-found` for a project
 * that isn't listed, or the code for an unreadable transcript.
 */
export async function lookupRequestedSession(
  deps: Pick<ServiceDeps, 'projectsRoot'>,
  request: GetSessionRequest
): Promise<RequestedSessionLookup> {
  const { projectDirName, sessionId } = request
  const project = await findProject(deps.projectsRoot, projectDirName)
  if (project === undefined) return { kind: 'error', code: 'not-found' }

  const sessions = await discoverSessions(project.path)
  const session = sessions.find((entry) => entry.sessionId === sessionId)
  if (session === undefined) return { kind: 'session-missing', ref: { projectDirName, sessionId } }

  if (!session.transcript.ok)
    return { kind: 'error', code: toIpcErrorCode(session.transcript.error) }
  return {
    kind: 'found',
    session: {
      projectDirName,
      sessionId,
      found: { project, session },
      transcript: session.transcript.value
    }
  }
}

/**
 * Finds a requested session in fresh listings.
 *
 * @param deps - The projects root.
 * @param request - A request parsed by `getSessionRequestSchema`, which keeps
 * its folder name and session id path-free.
 * @returns The requested session,
 * `not-found` when the project or session isn't listed, or the code for an
 * unreadable transcript.
 */
export async function findRequestedSession(
  deps: Pick<ServiceDeps, 'projectsRoot'>,
  request: GetSessionRequest
): Promise<IpcResult<RequestedSession>> {
  const lookup = await lookupRequestedSession(deps, request)
  if (lookup.kind === 'found') return okResult(lookup.session)
  return errResult(lookup.kind === 'error' ? lookup.code : 'not-found')
}
