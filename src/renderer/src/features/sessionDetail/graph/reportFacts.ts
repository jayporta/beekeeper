import type { AgentReportDto } from '../../../../../shared/ipc/agentDto'

/**
 * Sums an agent's own tokens across every model, speed and billing class. The
 * cache write counts both its 5-minute and its 1-hour window.
 *
 * @param report - The agent's report.
 * @returns The token total, or `null` when the report has no usage.
 */
export function reportTokens(report: AgentReportDto): number | null {
  if (report.tokenGroups.length === 0) return null
  let total = 0
  for (const { tokens } of report.tokenGroups) {
    total +=
      tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite5m + tokens.cacheWrite1h
  }
  return total
}

/**
 * Whether a report may be missing something: transcript lines that couldn't
 * be read, or a file list that may be incomplete.
 *
 * @param report - The agent's report.
 * @returns `true` when it may be incomplete.
 */
export function isPartialReport(report: AgentReportDto): boolean {
  return report.skippedLines > 0 || report.fileListIncomplete
}
