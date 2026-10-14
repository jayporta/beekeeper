import type { AgentReport } from '../../core/session/agentReports'
import { readFileChanges } from '../../core/session/fileDiff/readFileChanges'
import type { SessionScan } from '../../core/session/scanSession'
import { isMissingEntryError } from '../../core/transcript/isMissingEntryError'
import { toAgentId } from '../../core/transcript/ids'
import type { FileDiffDto } from '../../shared/ipc/fileDiffDto'
import type { IpcResult } from '../../shared/ipc/ipcResult'
import { getFileDiffRequestSchema } from '../../shared/ipc/requestSchemas'
import type { FoundSession } from './findProject'
import { findRequestedSession } from './findRequestedSession'
import type { IpcDeps } from './ipcDeps'
import { errResult, okResult } from './ipcResults'
import { mapFileDiff } from './mapFileDiff'
import { scanFoundSession } from './scanFoundSession'

/** Input for {@link locateAgent}. */
interface LocateAgentOptions {
  /** The listed session. */
  readonly found: FoundSession
  /** The session's scan. */
  readonly scan: SessionScan
  /** The lead's transcript path. */
  readonly transcriptPath: string
  /** The requested agent: a subagent's id, or `null` for the lead. */
  readonly agentId: string | null
}

/** The report and transcript path of the requested agent, or `undefined` when the scan has no readable one. */
function locateAgent(
  options: LocateAgentOptions
): { report: AgentReport; transcriptPath: string } | undefined {
  const { found, scan, transcriptPath, agentId } = options
  if (agentId === null) return { report: scan.lead, transcriptPath }

  const id = toAgentId(agentId)
  const result = scan.subagents.get(id)
  if (!result?.ok || !found.session.subagents.ok) return undefined
  const entry = found.session.subagents.value.find((candidate) => candidate.agentId === id)
  return entry === undefined
    ? undefined
    : { report: result.value, transcriptPath: entry.transcript.path }
}

/**
 * Reads what one agent changed in one file, from the patches its own Edit,
 * Write and Bash results recorded in its transcript.
 *
 * @remarks
 * The payload is validated first. The agent id and the file path are only ever
 * compared with the agent list and file touches of a fresh scan: neither
 * reaches a path or git. The scan is shared with `getSession` through the scan
 * cache, and the agent's one transcript is then streamed for the results of the
 * calls the scan credited to it, so a fork's copy of another agent's result is
 * never shown.
 *
 * @param deps - The projects root, the scan scheduler and the scan cache.
 * @param payload - The renderer's payload, validated here.
 * @returns The agent's changes to the file; `invalid-request` for a bad
 * payload; `not-found` when the project, session or agent is gone, the agent
 * never touched the file, or its transcript was removed since the scan.
 * @throws {Error} When the transcript cannot be read for a reason other than
 * being gone.
 */
export async function getFileDiffHandler(
  deps: IpcDeps,
  payload: unknown
): Promise<IpcResult<FileDiffDto>> {
  const request = getFileDiffRequestSchema.safeParse(payload)
  if (!request.success) return errResult('invalid-request')
  const { projectDirName, sessionId, agentId, filePath } = request.data

  const requested = await findRequestedSession(deps, { projectDirName, sessionId })
  if (!requested.ok) return requested
  const { found, transcript } = requested.value

  const scan = await scanFoundSession({ deps, found, transcript })
  const agent = locateAgent({ found, scan, transcriptPath: transcript.path, agentId })
  if (agent === undefined) return errResult('not-found')

  const touches = agent.report.fileTouches.filter((touch) => touch.filePath === filePath)
  if (touches.length === 0) return errResult('not-found')

  try {
    const changes = await readFileChanges({
      transcriptPath: agent.transcriptPath,
      toolUseIds: new Set(touches.map((touch) => touch.toolUseId)),
      filePath
    })
    return okResult(mapFileDiff({ filePath, touches, changes }))
  } catch (error) {
    if (isMissingEntryError(error)) return errResult('not-found')
    throw error
  }
}
