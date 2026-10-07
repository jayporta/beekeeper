import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'

/** How many agents of each kind a session has. */
export interface AgentCounts {
  /** The teammates grouped under a lead. */
  readonly teammates: number
  /** The plain subagents: those the session counts, less the agents that ran in workflow runs. */
  readonly subagents: number
  /** The workflow runs, `0` when the session's workflows are unknown. */
  readonly workflowRuns: number
  /** The agents that ran inside workflow runs, `0` when the session's workflows are unknown. */
  readonly workflowAgents: number
}

/**
 * Splits a session's agents into teammates, plain subagents, and workflow
 * runs with their agents. The session's subagent count includes the workflow
 * agents, so they come out of it. An unknown subagent count counts as none,
 * and unknown workflows leave every subagent plain.
 *
 * @param item - A session list item.
 * @returns The counts.
 */
export function agentCounts(item: SessionListItemDto): AgentCounts {
  const workflowAgents = item.workflows?.agents ?? 0
  return {
    teammates: item.team?.kind === 'lead' ? item.team.teammates.length : 0,
    subagents: Math.max(0, (item.subagentCount ?? 0) - workflowAgents),
    workflowRuns: item.workflows?.runs ?? 0,
    workflowAgents
  }
}
