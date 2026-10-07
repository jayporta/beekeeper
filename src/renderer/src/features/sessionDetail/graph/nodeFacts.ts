import type { AgentGraphNode, NodeWorkflow } from './agentGraphNode'
import type { GraphT } from './graphT'
import { runMembers } from './runMembers'

/** The run's phase count as text, or `null` when it has no phases or isn't a run. */
function phasesText(workflow: NodeWorkflow | null, t: GraphT): string | null {
  return workflow === null || workflow.phases.length === 0
    ? null
    : t('graph.node.phases', { count: workflow.phases.length })
}

/**
 * The second line of a node: the agent's type and model, for a teammate in
 * another folder that folder, or for a workflow run its kind and its phase
 * count, or its id when its name isn't unique, which would crowd the id out if
 * both were shown.
 *
 * @param node - The node.
 * @param t - The graph translate function.
 * @returns The pieces, empty when the node has none. Transcript-derived: render as plain text.
 */
export function nodeDetail(node: AgentGraphNode, t: GraphT): readonly string[] {
  if (node.kind === 'workflow') {
    const { workflow } = node
    return [
      t('graph.node.kind.workflow'),
      workflow?.duplicateName === true ? workflow.runId : phasesText(workflow, t)
    ].filter((part) => part !== null)
  }
  if (node.folder !== null) return [t('sessions:notes.in', { folder: node.folder })]
  return [node.agentType, node.model].filter((part) => part !== null)
}

/** What a run's accessible name says after its tokens: its phase count, its id when its name isn't unique, and how many of its agents are below it, at any depth. The kind is already said. */
function runDetails(node: AgentGraphNode, t: GraphT): readonly (string | null)[] {
  const { workflow } = node
  const agents = workflow === null ? 0 : runMembers(node.children, workflow.runId).length
  return [
    phasesText(workflow, t),
    workflow?.duplicateName === true ? workflow.runId : null,
    t('graph.node.agents', { count: agents })
  ]
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
 * phase count, its id when its name isn't unique, then how many agents it
 * holds, since the kind is already said. It carries everything the node
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
  const details = [
    node.tokens === null
      ? t('graph.node.tokensUnknown')
      : t('graph.node.tokens', { count: node.tokens }),
    ...(node.kind === 'workflow' ? runDetails(node, t) : nodeDetail(node, t)),
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
