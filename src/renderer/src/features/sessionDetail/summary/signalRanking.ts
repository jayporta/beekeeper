import { flattenPreorder } from '../graph/flattenPreorder'
import type { AgentGraphNode } from '../graph/agentGraphNode'

/** How many agents the Signals card lists. */
export const SIGNAL_ROW_LIMIT = 6

/** An agent of the Signals card, with the marks that put it there. */
export interface SignalAgent extends AgentGraphNode {
  /** Its marks, which are known and have tool errors. */
  readonly marks: NonNullable<AgentGraphNode['marks']>
}

/**
 * Ranks the agents of a graph that had tool errors. Workflow runs and agents
 * whose report isn't known are left out.
 *
 * @param root - The graph's root.
 * @returns The agents, most tool errors first, ties in the graph's preorder.
 */
export function signalRanking(root: AgentGraphNode): readonly SignalAgent[] {
  return flattenPreorder(root)
    .nodes.filter(
      (node): node is SignalAgent =>
        node.kind !== 'workflow' && node.marks !== null && node.marks.toolErrors > 0
    )
    .sort((a, b) => b.marks.toolErrors - a.marks.toolErrors)
}
