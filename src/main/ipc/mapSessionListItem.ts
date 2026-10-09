import type { AgentSearchTerm } from '../../core/session/agentSearchTerms'
import type { SessionEntry } from '../../core/transcript/discoverSessions'
import type { SubagentEntry } from '../../core/transcript/discoverSubagents'
import type { ProjectDirName } from '../../core/transcript/ids'
import type { Result } from '../../core/shared/result'
import type { SessionSummary } from '../../core/transcript/summary/sessionSummary'
import type { UnreadableError } from '../../core/transcript/unreadableError'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import type { WorkflowCountsDto } from '../../shared/ipc/workflowRunDto'
import { distinctRunIds } from './distinctRunIds'
import { errResult, okResult } from './ipcResults'
import { mapAgentSignals } from './mapAgentSignals'
import { mapSessionRole } from './mapSessionRole'
import { toIpcErrorCode } from './toIpcErrorCode'

/** One discovered session with the outcome of reading its summary. */
export interface ScannedSession {
  /** The project folder the session was discovered in. */
  readonly projectDirName: ProjectDirName
  /** The session as discovery found it. */
  readonly entry: SessionEntry
  /** The summary read, or why there is none. A failed transcript stat carries its own error. */
  readonly summary: Result<SessionSummary, UnreadableError>
}

/** A scanned session with its search terms, ready to list. */
export interface ListableSession extends ScannedSession {
  /** The search terms of the session's subagents. */
  readonly agentTerms: readonly AgentSearchTerm[]
  /** The distinct names of the session's workflow runs. */
  readonly workflowRunNames: readonly string[]
}

/**
 * Counts a session's workflow runs and the agents inside them.
 * @param subagents - The session's discovered subagents.
 * @returns The distinct run count and the number of subagents that ran in a run.
 */
function countWorkflows(subagents: readonly SubagentEntry[]): WorkflowCountsDto {
  const agents = subagents.filter(({ workflowRunId }) => workflowRunId !== null).length
  return { runs: distinctRunIds(subagents).length, agents }
}

/**
 * Maps a scanned session to its list item, field by field, so no unknown
 * summary field crosses the bridge.
 *
 * @param scanned - The session, its summary read, and its search terms.
 * @param team - The session's team entry, or `null` when it has none.
 * @returns The item as sent to the renderer. Its `team` is `null` whenever
 * the transcript or summary could not be read.
 */
export function mapSessionListItem(
  scanned: ListableSession,
  team: SessionTeamDto | null
): SessionListItemDto {
  const { entry, summary } = scanned
  const subagentCount = entry.subagents.ok ? entry.subagents.value.length : null
  const workflows = entry.subagents.ok ? countWorkflows(entry.subagents.value) : null
  if (!entry.transcript.ok) {
    return {
      projectDirName: scanned.projectDirName,
      sessionId: entry.sessionId,
      modifiedMs: null,
      sizeBytes: null,
      subagentCount,
      workflows,
      agentTerms: [],
      workflowRunNames: [],
      summary: errResult(toIpcErrorCode(entry.transcript.error)),
      team: null,
      archived: false
    }
  }

  const file = entry.transcript.value
  return {
    projectDirName: scanned.projectDirName,
    sessionId: entry.sessionId,
    modifiedMs: file.mtimeMs,
    sizeBytes: file.size,
    subagentCount,
    workflows,
    agentTerms: scanned.agentTerms.map(({ name, description, agentType }) => ({
      name,
      description,
      agentType
    })),
    workflowRunNames: [...scanned.workflowRunNames],
    summary: summary.ok
      ? okResult({
          title: summary.value.title,
          usage:
            summary.value.usage === null
              ? null
              : {
                  totalUSD: summary.value.usage.totalUSD,
                  totalTokens: summary.value.usage.totalTokens
                },
          activity:
            summary.value.activity === null
              ? null
              : {
                  earliestMs: summary.value.activity.earliestMs,
                  latestMs: summary.value.activity.latestMs
                },
          skippedLines: summary.value.skippedLines,
          role: mapSessionRole(summary.value.role),
          model: summary.value.model,
          limitHit:
            summary.value.limitHit === null
              ? null
              : {
                  window: summary.value.limitHit.window,
                  resetsAtMs: summary.value.limitHit.resetsAtMs
                },
          transcriptTokens: summary.value.transcriptTokens,
          signals: mapAgentSignals(summary.value.signals)
        })
      : errResult(toIpcErrorCode(summary.error)),
    team: summary.ok ? team : null,
    archived: false
  }
}
