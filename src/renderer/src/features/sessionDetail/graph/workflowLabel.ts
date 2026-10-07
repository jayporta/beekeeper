import type { SessionDetailT } from '../sessionDetailT'
import type { NodeWorkflow } from './agentGraphNode'

/**
 * Names a workflow run where its own node isn't the one speaking: as the
 * parent of an agent, or in an agent's kicker. A run whose name another run of
 * the session shares carries its id too, so the two can be told apart.
 *
 * @param workflow - The run's facts.
 * @param t - The session detail translate function.
 * @returns The name, with the run id when the name isn't unique. Transcript-derived: render as plain text.
 */
export function workflowLabel(workflow: NodeWorkflow, t: SessionDetailT): string {
  return workflow.duplicateName
    ? t('graph.node.workflowWithId', { name: workflow.name, runId: workflow.runId })
    : workflow.name
}
