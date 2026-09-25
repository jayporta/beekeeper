import type { TranscriptFileInfo } from '../../core/transcript/statTranscriptFile'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { getSessionRequestSchema } from '../../shared/ipc/requestSchemas'
import { findSession, type FoundSession } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { toIpcErrorCode } from './toIpcErrorCode'

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

/**
 * Validates a session request and finds its session in fresh listings.
 *
 * @param deps - The projects root.
 * @param payload - The renderer's payload, validated here.
 * @returns The requested session, `invalid-request` for a bad payload,
 * `not-found` when the project or session isn't listed, or the code for an
 * unreadable transcript.
 */
export async function findRequestedSession(
  deps: Pick<IpcDeps, 'projectsRoot'>,
  payload: unknown
): Promise<IpcResult<RequestedSession>> {
  const request = getSessionRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const { projectDirName, sessionId } = request.data
  const found = await findSession({
    projectsRoot: deps.projectsRoot,
    dirName: projectDirName,
    sessionId
  })
  if (found === undefined) return errResult('not-found')

  const { transcript } = found.session
  if (!transcript.ok) return errResult(toIpcErrorCode(transcript.error))
  return okResult({ projectDirName, sessionId, found, transcript: transcript.value })
}
