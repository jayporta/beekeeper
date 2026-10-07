import type { AgentGraphNode } from '../graph/agentGraphNode'
import { workflowLabel } from '../graph/workflowLabel'
import type { SessionDetailT } from '../sessionDetailT'

/**
 * Says what kind of agent the inspector is showing. A teammate that lives in
 * the lead's transcript, rather than in a session of its own, says so. A
 * workflow run says whether it completed, and an agent in one names it, with the
 * run id when another run shares the name.
 *
 * @param node - The inspected node.
 * @param t - The session detail translate function.
 * @returns The kicker. Includes a transcript-derived agent type or workflow name for a subagent.
 */
export function inspectorKicker(node: AgentGraphNode, t: SessionDetailT): string {
  if (node.kind === 'lead') return t('inspector.kicker.lead')
  if (node.kind === 'teammate') {
    return node.selection?.kind === 'subagent'
      ? t('inspector.kicker.teammateInSession')
      : t('inspector.kicker.teammate')
  }
  if (node.kind === 'workflow') {
    return node.workflow?.completed === true
      ? t('inspector.kicker.workflowCompleted')
      : t('inspector.kicker.workflow')
  }
  if (node.workflow !== null) {
    return node.agentType === null
      ? t('inspector.kicker.subagentInWorkflowUntyped', { name: workflowLabel(node.workflow, t) })
      : t('inspector.kicker.subagentInWorkflow', {
          name: workflowLabel(node.workflow, t),
          type: node.agentType
        })
  }
  return node.agentType === null
    ? t('inspector.kicker.subagentUntyped')
    : t('inspector.kicker.subagent', { type: node.agentType })
}
