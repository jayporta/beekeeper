import type { AgentReportDto } from '../../../../shared/ipc/agentDto'
import type { SessionDetailDto } from '../../../../shared/ipc/sessionDetailDto'

/** The reports of a session's lead and subagents, and whether every one could be read. */
export interface ReadableReports {
  /** The lead's report, then each subagent report that could be read. */
  readonly reports: readonly AgentReportDto[]
  /** Whether the subagents folder and every subagent's report could be read. */
  readonly complete: boolean
}

/**
 * Gathers the reports a session's detail holds for the lead and its subagents.
 *
 * @param detail - The session's loaded detail.
 * @returns The reports that could be read, and whether none was missing.
 */
export function readableReports(detail: SessionDetailDto): ReadableReports {
  if (!detail.subagents.ok) return { reports: [detail.lead], complete: false }
  const reports = [detail.lead]
  let complete = true
  for (const { report } of detail.subagents.value) {
    if (report.ok) reports.push(report.value)
    else complete = false
  }
  return { reports, complete }
}
