import { sameAgent } from '@renderer/features/navigation/sameAgent'
import type { SelectedAgent } from '@renderer/features/navigation/state/useNavigationStore'
import type { AgentGraphNode, AgentKey } from './agentGraphNode'

/**
 * Finds the node a selection stands for. A selection the graph doesn't hold,
 * such as a teammate a chip named that isn't in the lead's list, stands for
 * the lead, so the view always has an agent selected and never fails.
 *
 * @param nodes - Every node in the graph.
 * @param selected - The navigation store's selected agent, or `null` for the lead.
 * @returns The key of the selected node.
 */
export function selectedAgentKey(
  nodes: readonly AgentGraphNode[],
  selected: SelectedAgent | null
): AgentKey {
  if (selected === null) return 'lead'
  return nodes.find((node) => sameAgent(node.selection, selected))?.key ?? 'lead'
}
