import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'
import { EMPTY_AGENT_SIGNALS_DTO } from '../../../../../shared/ipc/emptyAgentSignals'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import { reportTokens } from '../graph/reportFacts'

/**
 * Reads the reports of a run's agents out of the session's detail, in the order
 * given, skipping an agent whose report is unreadable or that the detail
 * doesn't hold.
 *
 * @param detail - The session's detail, which holds the agents' reports.
 * @param agentIds - The ids of the run's agents.
 * @returns The readable reports.
 */
export function readableReports(
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
 * read a run's tokens by class, cost, messages and span like an agent's. A run
 * shows no files, so the report holds none, and the workflow inspector doesn't
 * render signals, so the report holds empty ones.
 *
 * @param reports - The run's readable agent reports, from {@link readableReports}.
 * @returns The combined report: every token group, the summed message count and skipped lines, and a span from the earliest start to the latest end.
 * @remarks The run's active time is the smaller of that span and the sum of its agents' active times. A run's agents work in parallel, so the sum alone would count overlapping time twice, and the span alone would include stretches when none of them was working.
 */
export function runReport(reports: readonly AgentReportDto[]): AgentReportDto {
  const spans = reports.flatMap(({ activity }) => (activity === null ? [] : [activity]))
  const earliestMs = Math.min(...spans.map((span) => span.earliestMs))
  const latestMs = Math.max(...spans.map((span) => span.latestMs))
  const summedActiveMs = spans.reduce((total, { activeMs }) => total + activeMs, 0)
  return {
    tokenGroups: reports.flatMap(({ tokenGroups }) => tokenGroups),
    messageCount: reports.reduce((total, { messageCount }) => total + messageCount, 0),
    skippedLines: reports.reduce((total, { skippedLines }) => total + skippedLines, 0),
    fileTouches: [],
    fileListIncomplete: false,
    signals: EMPTY_AGENT_SIGNALS_DTO,
    activity:
      spans.length === 0
        ? null
        : { earliestMs, latestMs, activeMs: Math.min(latestMs - earliestMs, summedActiveMs) }
  }
}

/**
 * Whether some of a run's agents leave its token figures low: an agent's report
 * is unreadable or missing, or recorded no tokens. Skipped transcript lines
 * aren't counted here, since the run report sums them. An incomplete file list
 * doesn't count, since a run shows no files.
 *
 * @param reports - The run's readable agent reports, from {@link readableReports}.
 * @param agentCount - How many agents the run has, readable or not.
 * @returns `true` when some agent leaves the run's tokens low.
 */
export function runAgentsIncomplete(
  reports: readonly AgentReportDto[],
  agentCount: number
): boolean {
  return reports.length < agentCount || reports.some((report) => reportTokens(report) === null)
}
