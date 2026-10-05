import type { AgentGraphNode } from '../graph/agentGraphNode'
import type { SessionDetailT } from '../sessionDetailT'

/**
 * Says what kind of agent the inspector is showing. A teammate that lives in
 * the lead's transcript, rather than in a session of its own, says so.
 *
 * @param node - The inspected node.
 * @param t - The session detail translate function.
 * @returns The kicker. Includes a transcript-derived agent type for a subagent.
 */
export function inspectorKicker(node: AgentGraphNode, t: SessionDetailT): string {
  if (node.kind === 'lead') return t('inspector.kicker.lead')
  if (node.kind === 'teammate') {
    return node.selection?.kind === 'subagent'
      ? t('inspector.kicker.teammateInSession')
      : t('inspector.kicker.teammate')
  }
  return node.agentType === null
    ? t('inspector.kicker.subagentUntyped')
    : t('inspector.kicker.subagent', { type: node.agentType })
}
