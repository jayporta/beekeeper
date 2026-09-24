import type { AgentNodeDto, AgentReportDto, SubagentReportDto } from './agentDto'
import type { IpcResult } from './ipcResult'
import type { ReconciliationDto } from './reconciliationDto'

/** A session scanned in full: its agent tree, each agent's report, and its cost reconciliation. */
export interface SessionDetailDto {
  /** The session's id. */
  readonly sessionId: string
  /** The agent tree, rooted at the lead. */
  readonly tree: AgentNodeDto
  /** The lead's report. */
  readonly lead: AgentReportDto
  /** Each subagent's report sorted by agent id, or a code-only error when the subagents folder can't be read. */
  readonly subagents: IpcResult<readonly SubagentReportDto[]>
  /** Usage from the transcripts beside what the session recorded. */
  readonly reconciliation: ReconciliationDto
}
