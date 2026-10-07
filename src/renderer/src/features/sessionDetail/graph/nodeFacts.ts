import type { AgentGraphNode, NodeWorkflow } from './agentGraphNode'
import type { GraphT } from './graphT'

/**
 * What a workflow run adds to its second line: its phase count, and its run id
 * when another run has the same name.
 *
 * @param workflow - The run's facts, or `null` for a node that isn't a run.
 * @param t - The graph translate function.
 * @returns The pieces, empty when the run has none. Transcript-derived: render as plain text.
 */
function workflowDetail(workflow: NodeWorkflow | null, t: GraphT): readonly string[] {
  if (workflow === null) return []
  return [
    workflow.phases.length > 0 ? t('graph.node.phases', { count: workflow.phases.length }) : null,
    workflow.duplicateName ? workflow.runId : null
  ].filter((part) => part !== null)
}

/**
 * The second line of a node: the agent's type and model, for a teammate in
 * another folder that folder, or for a workflow run its kind, phase count and,
 * when its name isn't unique, its id.
 *
 * @param node - The node.
 * @param t - The graph translate function.
 * @returns The pieces, empty when the node has none. Transcript-derived: render as plain text.
 */
export function nodeDetail(node: AgentGraphNode, t: GraphT): readonly string[] {
  if (node.kind === 'workflow') {
    return [t('graph.node.kind.workflow'), ...workflowDetail(node.workflow, t)]
  }
  if (node.folder !== null) return [t('sessions:notes.in', { folder: node.folder })]
  return [node.agentType, node.model].filter((part) => part !== null)
}

/** What {@link nodeAccessibleName} needs besides the node. */
interface NodeNameOptions {
  /** The graph translate function. */
  readonly t: GraphT
  /** Whether the teammate's own subagents are still loading. */
  readonly loading: boolean
  /** The name of the agent that spawned this one, or `null` for the root. Transcript-derived. */
  readonly parent: string | null
}

/**
 * The accessible name of a node's button: its name, its kind and parent, its
 * tokens, its second line, then each flag. A workflow run's second line is its
 * phase count and id, then how many agents it holds, since the kind is already
 * said. It carries everything the node
 * shows, and the edge to its parent, so a screen reader hears the same facts a
 * sighted reader sees and can tell same-named siblings apart by where they hang.
 *
 * @param node - The node.
 * @param options - The translate function, whether the node is still loading, and its parent's name.
 * @returns The name. Transcript-derived: render as plain text.
 */
export function nodeAccessibleName(
  node: AgentGraphNode,
  { t, loading, parent }: NodeNameOptions
): string {
  const isRun = node.kind === 'workflow'
  const details = [
    node.tokens === null
      ? t('graph.node.tokensUnknown')
      : t('graph.node.tokens', { count: node.tokens }),
    ...(isRun ? workflowDetail(node.workflow, t) : nodeDetail(node, t)),
    isRun ? t('graph.node.agents', { count: node.children.length }) : null,
    node.stopped ? t('graph.node.stopped') : null,
    loading ? t('graph.node.loading') : null,
    node.partial ? t('graph.node.partial') : null
  ].filter((part) => part !== null)

  const facts = {
    name: node.name,
    kind: t(`graph.node.kind.${node.kind}`),
    details: details.join(t('graph.node.labelSeparator'))
  }
  return parent === null
    ? t('graph.node.label', facts)
    : t('graph.node.labelWithParent', { ...facts, parent })
}
