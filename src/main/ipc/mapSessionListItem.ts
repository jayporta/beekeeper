import type { SessionEntry } from '../../core/transcript/discoverSessions'
import type { ProjectDirName } from '../../core/transcript/ids'
import type { Result } from '../../core/shared/result'
import type { SessionSummary } from '../../core/transcript/summary/sessionSummary'
import type { UnreadableError } from '../../core/transcript/unreadableError'
import type { SessionListItemDto } from '../../shared/ipc/sessionListDto'
import type { SessionTeamDto } from '../../shared/ipc/sessionTeamDto'
import { errResult, okResult } from './ipcResults'
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

/**
 * Maps a scanned session to its list item, field by field, so no unknown
 * summary field crosses the bridge.
 *
 * @param scanned - The session and its summary read.
 * @param team - The session's team entry, or `null` when it has none.
 * @returns The item as sent to the renderer. Its `team` is `null` whenever
 * the transcript or summary could not be read.
 */
export function mapSessionListItem(
  scanned: ScannedSession,
  team: SessionTeamDto | null
): SessionListItemDto {
  const { entry, summary } = scanned
  const subagentCount = entry.subagents.ok ? entry.subagents.value.length : null
  if (!entry.transcript.ok) {
    return {
      projectDirName: scanned.projectDirName,
      sessionId: entry.sessionId,
      modifiedMs: null,
      sizeBytes: null,
      subagentCount,
      summary: errResult(toIpcErrorCode(entry.transcript.error)),
      team: null
    }
  }

  const file = entry.transcript.value
  return {
    projectDirName: scanned.projectDirName,
    sessionId: entry.sessionId,
    modifiedMs: file.mtimeMs,
    sizeBytes: file.size,
    subagentCount,
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
          transcriptTokens: summary.value.transcriptTokens
        })
      : errResult(toIpcErrorCode(summary.error)),
    team: summary.ok ? team : null
  }
}
