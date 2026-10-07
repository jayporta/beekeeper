import type { SessionListItemDto } from '../../../../shared/ipc/sessionListDto'
import { agentCounts, type AgentCounts } from './agentCounts'
import type { SessionsT } from './sessionsT'

/**
 * Describes a session's workflow runs and the agents in them, as in "2
 * workflows (8 agents)".
 *
 * @param counts - The session's agent counts.
 * @param t - The sessions translate function.
 * @returns The text, or `null` when the session has no workflow runs.
 */
export function workflowsText(counts: AgentCounts, t: SessionsT): string | null {
  if (counts.workflowRuns === 0) return null
  return t('agents.workflows', {
    count: counts.workflowRuns,
    agents: t('agents.workflowAgents', { count: counts.workflowAgents })
  })
}

/**
 * Whether a session has any teammates, subagents, or workflow runs.
 *
 * @param item - A session list item.
 * @returns `true` when it has at least one. `false` when it has none or when that can't be told.
 */
export function hasAgents(item: SessionListItemDto): boolean {
  const { teammates, subagents, workflowRuns } = agentCounts(item)
  return teammates > 0 || subagents > 0 || workflowRuns > 0
}

/**
 * Describes the agents a session used, for a card's agent count: the
 * teammates grouped under a lead, the subagents it spawned, and its workflow
 * runs, as in "3 teammates, 2 subagents, 1 workflow (8 agents)". A workflow's
 * agents are counted in the workflow, not as subagents.
 *
 * @param item - A session list item.
 * @param t - The sessions translate function.
 * @returns The text, `'None'` when the session used none of them, or `null` when
 *   that can't be told: the summary couldn't be read, or the subagent count is
 *   unknown and there are no teammates.
 */
export function agentCountLabel(item: SessionListItemDto, t: SessionsT): string | null {
  if (!item.summary.ok) return null

  const counts = agentCounts(item)
  const parts = [
    counts.teammates > 0 ? t('agents.teammates', { count: counts.teammates }) : null,
    counts.subagents > 0 ? t('agents.subagents', { count: counts.subagents }) : null,
    workflowsText(counts, t)
  ].filter((part) => part !== null)

  if (parts.length > 0) return parts.join(t('agents.separator'))
  return item.subagentCount === null ? null : t('agents.none')
}
