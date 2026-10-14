import type { AgentReportDto } from '../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'

/** The reports of a session's lead and subagents, and whether every one could be read whole. */
export interface ReadableReports {
  /** The lead's report, then each subagent report that could be read. */
  readonly reports: readonly AgentReportDto[]
  /** Whether the subagents folder and every report could be read, and none skipped transcript lines. */
  readonly complete: boolean
}

/**
 * Gathers the reports a session's detail holds for the lead and its subagents.
 *
 * @param detail - The session's loaded detail.
 * @returns The reports that could be read, and whether none was missing or cut short by unreadable lines.
 */
export function readableReports(detail: SessionDetailDto): ReadableReports {
  const reports = [detail.lead]
  let complete = detail.subagents.ok && detail.lead.skippedLines === 0
  if (!detail.subagents.ok) return { reports, complete }
  for (const { report } of detail.subagents.value) {
    if (report.ok) {
      reports.push(report.value)
      if (report.value.skippedLines > 0) complete = false
    } else complete = false
  }
  return { reports, complete }
}
