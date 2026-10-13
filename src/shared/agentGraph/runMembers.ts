import type { AgentGraphNode } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'

/**
 * Finds the agents that ran in a workflow run, wherever they sit below the
 * given agents. A member the lead didn't spawn is nested under the agent that
 * spawned it, so a run's members aren't only its node's direct children. An
 * agent with no run, or in another run, isn't a member, though a member below
 * it still is. It walks without recursing, so a deep spawn chain can't
 * overflow the stack.
 *
 * @param agents - The agents to search, each with everything below it.
 * @param runId - The run whose members to find.
 * @returns The members in preorder: each before the agents it spawned.
 */
export function runMembers(agents: readonly AgentGraphNode[], runId: string): AgentGraphNode[] {
  return agents.flatMap((agent) =>
    flattenPreorder(agent).nodes.filter((node) => node.workflow?.runId === runId)
  )
}
