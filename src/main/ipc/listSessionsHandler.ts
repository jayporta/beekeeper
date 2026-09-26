import { discoverSessions, type SessionEntry } from '../../core/transcript/discoverSessions'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { listSessionsRequestSchema } from '../../shared/ipc/requestSchemas'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import { findProject } from './findProject'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapSessionRole } from './mapSessionRole'
import { toIpcErrorCode } from './toIpcErrorCode'

async function mapSession(
  entry: SessionEntry,
  deps: Pick<IpcDeps, 'summaryCache' | 'summaries'>
): Promise<SessionListItemDto> {
  const subagentCount = entry.subagents.ok ? entry.subagents.value.length : null
  if (!entry.transcript.ok) {
    return {
      sessionId: entry.sessionId,
      modifiedMs: null,
      sizeBytes: null,
      subagentCount,
      summary: errResult(toIpcErrorCode(entry.transcript.error))
    }
  }

  const file = entry.transcript.value
  const summary = await deps.summaries.run(`${file.path}\0${file.mtimeMs}\0${file.size}`, () =>
    deps.summaryCache.read(file)
  )
  return {
    sessionId: entry.sessionId,
    modifiedMs: file.mtimeMs,
    sizeBytes: file.size,
    subagentCount,
    summary: summary.ok
      ? okResult({
          title: summary.value.title,
          cost: summary.value.cost === null ? null : { totalUSD: summary.value.cost.totalUSD },
          activity:
            summary.value.activity === null
              ? null
              : {
                  earliestMs: summary.value.activity.earliestMs,
                  latestMs: summary.value.activity.latestMs
                },
          skippedLines: summary.value.skippedLines,
          role: mapSessionRole(summary.value.role)
        })
      : errResult(toIpcErrorCode(summary.error))
  }
}

/**
 * Lists a project's sessions with their summaries, read through the
 * app-lifetime cache. Summary reads are shared per transcript state (path, mtime, size) and capped by
 * the summaries scheduler.
 *
 * @param deps - The projects root, the summary cache, and the summaries scheduler.
 * @param payload - The renderer's payload, validated here.
 * @returns The sessions, `invalid-request` for a bad payload, or `not-found` for an unknown project.
 */
export async function listSessionsHandler(
  deps: Pick<IpcDeps, 'projectsRoot' | 'summaryCache' | 'summaries'>,
  payload: unknown
): Promise<IpcResult<readonly SessionListItemDto[]>> {
  const request = listSessionsRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')

  const project = await findProject(deps.projectsRoot, request.data.projectDirName)
  if (project === undefined) return errResult('not-found')

  const sessions = await discoverSessions(project.path)
  return okResult(await Promise.all(sessions.map((entry) => mapSession(entry, deps))))
}
