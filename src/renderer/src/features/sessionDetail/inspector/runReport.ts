import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import { reportTokens } from '../graph/reportFacts'

/** The readable reports of the given agents in the order given, skipping one that is unreadable or that the detail doesn't hold. */
function readableReports(
  detail: SessionDetailDto,
  agentIds: readonly string[]
): readonly AgentReportDto[] {
  if (!detail.subagents.ok) return []
  const byId = new Map(detail.subagents.value.map(({ agentId, report }) => [agentId, report]))
  return agentIds.flatMap((agentId) => {
    const report = byId.get(agentId)
    return report?.ok ? [report.value] : []
  })
}

/**
 * Adds up the reports of a workflow run's agents into one, so the inspector can
 * read a run's tokens by class, cost, messages and span like an agent's. An
 * agent whose report is unreadable, or that the detail doesn't hold, adds
 * nothing. A run shows no files, so the report holds none.
 *
 * @param detail - The session's detail, which holds the agents' reports.
 * @param agentIds - The ids of the run's agents.
 * @returns The combined report: every token group, the summed message count and skipped lines, and a span from the earliest start to the latest end.
 */
export function runReport(detail: SessionDetailDto, agentIds: readonly string[]): AgentReportDto {
  const reports = readableReports(detail, agentIds)
  const spans = reports.flatMap(({ activity }) => (activity === null ? [] : [activity]))
  return {
    tokenGroups: reports.flatMap(({ tokenGroups }) => tokenGroups),
    messageCount: reports.reduce((total, { messageCount }) => total + messageCount, 0),
    skippedLines: reports.reduce((total, { skippedLines }) => total + skippedLines, 0),
    fileTouches: [],
    fileListIncomplete: false,
    activity:
      spans.length === 0
        ? null
        : {
            earliestMs: Math.min(...spans.map(({ earliestMs }) => earliestMs)),
            latestMs: Math.max(...spans.map(({ latestMs }) => latestMs))
          }
  }
}

/**
 * Whether a run's token figures may be low: an agent's report is unreadable or
 * missing, skipped transcript lines, or recorded no tokens. An incomplete file
 * list doesn't count, since a run shows no files.
 *
 * @param detail - The session's detail, which holds the agents' reports.
 * @param agentIds - The ids of the run's agents.
 * @returns `true` when the run's tokens may be low.
 */
export function runTokensPartial(detail: SessionDetailDto, agentIds: readonly string[]): boolean {
  const reports = readableReports(detail, agentIds)
  return (
    reports.length < agentIds.length ||
    reports.some((report) => report.skippedLines > 0 || reportTokens(report) === null)
  )
}
