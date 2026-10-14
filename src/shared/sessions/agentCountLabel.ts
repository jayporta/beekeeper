import type { SessionListItemDto } from '../ipc/sessionListDto'
import { agentCounts, type AgentCounts } from './agentCounts'

/** The words an agent count uses, in the caller's language. */
export interface AgentCountWords {
  /** The teammates of a lead, as in "3 teammates". */
  readonly teammates: (count: number) => string
  /** The subagents a session spawned, as in "2 subagents". */
  readonly subagents: (count: number) => string
  /** The workflow runs, with their agents already worded, as in "2 workflows (8 agents)". */
  readonly workflows: (count: number, agents: string) => string
  /** The agents in workflow runs, as in "8 agents". */
  readonly workflowAgents: (count: number) => string
  /** What joins the parts. */
  readonly separator: string
  /** What a session with no agents reads. */
  readonly none: string
}

/**
 * Describes a session's workflow runs and the agents in them, as in "2
 * workflows (8 agents)".
 *
 * @param counts - The session's agent counts.
 * @param words - The agent count words, in the caller's language.
 * @returns The text, or `null` when the session has no workflow runs.
 */
export function workflowsText(counts: AgentCounts, words: AgentCountWords): string | null {
  if (counts.workflowRuns === 0) return null
  return words.workflows(counts.workflowRuns, words.workflowAgents(counts.workflowAgents))
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
 * @param words - The agent count words, in the caller's language.
 * @returns The text, the `none` word when the session used none of them, or `null` when
 *   that can't be told: the summary couldn't be read, or the subagent count is
 *   unknown and there are no teammates.
 */
export function agentCountLabel(item: SessionListItemDto, words: AgentCountWords): string | null {
  if (!item.summary.ok) return null

  const counts = agentCounts(item)
  const parts = [
    counts.teammates > 0 ? words.teammates(counts.teammates) : null,
    counts.subagents > 0 ? words.subagents(counts.subagents) : null,
    workflowsText(counts, words)
  ].filter((part) => part !== null)

  if (parts.length > 0) return parts.join(words.separator)
  return item.subagentCount === null ? null : words.none
}
