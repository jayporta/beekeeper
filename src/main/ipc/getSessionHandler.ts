import { scanSession } from '../../core/session/scanSession'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { getSessionRequestSchema } from '../../shared/ipc/requestSchemas'
import type { SessionDetailDto } from '../../shared/ipc/sessionDetailDto'
import { findSession } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapSessionScan } from './mapSessionScan'
import { toIpcErrorCode } from './toIpcErrorCode'

/**
 * Scans one session in full. Concurrent calls for the same session state
 * (same transcript size and mtime) share one scan, and the scheduler caps
 * how many sessions scan at once.
 *
 * @param deps - The projects root and the scan scheduler.
 * @param payload - The renderer's payload, validated here.
 * @returns The session detail, `invalid-request` for a bad payload, or
 * `not-found` when the project or session isn't in a fresh listing. A
 * transcript that vanishes mid-scan rejects, and `guardIpc` turns the
 * rejection into a code-only error. An unreadable subagents folder comes back
 * inside the detail as `subagents: { ok: false }`.
 */
export async function getSessionHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'scans'>,
  payload: unknown
): Promise<IpcResult<SessionDetailDto>> {
  const request = getSessionRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const { projectDirName, sessionId } = request.data
  const found = await findSession({
    projectsRoot: deps.projectsRoot,
    dirName: projectDirName,
    sessionId
  })
  if (found === undefined) return errResult('not-found')

  const { transcript, subagents } = found.session
  if (!transcript.ok) return errResult(toIpcErrorCode(transcript.error))

  const { path, mtimeMs, size } = transcript.value
  const scanKey = [projectDirName, sessionId, mtimeMs, size, subagents.ok].join('\0')
  const scan = await deps.scans.run(scanKey, () =>
    scanSession({
      leadPath: path,
      subagents: subagents.ok ? subagents.value : [],
      subagentsUnreadable: !subagents.ok
    })
  )
  const subagentsError = subagents.ok ? null : toIpcErrorCode(subagents.error)
  return okResult(mapSessionScan({ sessionId, scan, subagentsError }))
}
