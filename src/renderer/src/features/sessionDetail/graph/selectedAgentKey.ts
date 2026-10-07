import type { SelectedAgent } from '@renderer/features/navigation/state/useNavigationStore'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
import type { AgentGraphNode, AgentKey } from './agentGraphNode'

/** Whether a node's selection picks the same agent as `selected`. */
function picks(selection: SelectedAgent | null, selected: SelectedAgent): boolean {
  if (selection === null) return false
  switch (selection.kind) {
    case 'subagent':
      return (
        selected.kind === 'subagent' &&
        selected.agentId === selection.agentId &&
        sessionKey(selected.ownerRef) === sessionKey(selection.ownerRef)
      )
    case 'teammate':
      return selected.kind === 'teammate' && sessionKey(selected.ref) === sessionKey(selection.ref)
    case 'workflow':
      return (
        selected.kind === 'workflow' &&
        selected.runId === selection.runId &&
        sessionKey(selected.ownerRef) === sessionKey(selection.ownerRef)
      )
  }
}

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
  return nodes.find((node) => picks(node.selection, selected))?.key ?? 'lead'
}
