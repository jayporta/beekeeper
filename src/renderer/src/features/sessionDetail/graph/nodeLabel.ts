import type { SessionDetailT } from '../sessionDetailT'
import type { AgentGraphNode } from './agentGraphNode'
import { workflowLabel } from './workflowLabel'

/**
 * Names a node where its own button isn't the one speaking: as the parent of
 * another node, or in the selection announcement. A run carries its id too
 * when another run of the session shares its name.
 *
 * @param node - The node to name.
 * @param t - The session detail translate function.
 * @returns The node's name, or the run's label. Transcript-derived: render as plain text.
 */
export function nodeLabel(node: AgentGraphNode, t: SessionDetailT): string {
  return node.kind === 'workflow' && node.workflow !== null
    ? workflowLabel(node.workflow, t)
    : node.name
}
