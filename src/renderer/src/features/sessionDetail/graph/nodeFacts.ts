import type { AgentGraphNode } from './agentGraphNode'
import type { GraphT } from './graphT'

/**
 * The second line of a node: the agent's type and model, or for a teammate in
 * another folder, that folder.
 *
 * @param node - The node.
 * @param t - The graph translate function.
 * @returns The pieces, empty when the node has none. Transcript-derived: render as plain text.
 */
export function nodeDetail(node: AgentGraphNode, t: GraphT): readonly string[] {
  if (node.folder !== null) return [t('sessions:notes.in', { folder: node.folder })]
  return [node.agentType, node.model].filter((part) => part !== null)
}

/** What {@link nodeAccessibleName} needs besides the node. */
interface NodeNameOptions {
  /** The graph translate function. */
  readonly t: GraphT
  /** Whether the teammate's own subagents are still loading. */
  readonly loading: boolean
}

/**
 * The accessible name of a node's button: its name, its kind, its tokens, its
 * second line, then each flag. It carries everything the node shows, so a
 * screen reader hears the same facts a sighted reader sees.
 *
 * @param node - The node.
 * @param options - The translate function, and whether the node is still loading.
 * @returns The name. Transcript-derived: render as plain text.
 */
export function nodeAccessibleName(node: AgentGraphNode, { t, loading }: NodeNameOptions): string {
  const details = [
    node.tokens === null
      ? t('graph.node.tokensUnknown')
      : t('graph.node.tokens', { count: node.tokens }),
    ...nodeDetail(node, t),
    node.stopped ? t('graph.node.stopped') : null,
    loading ? t('graph.node.loading') : null,
    node.partial ? t('graph.node.partial') : null
  ].filter((part) => part !== null)

  return t('graph.node.label', {
    name: node.name,
    kind: t(`graph.node.kind.${node.kind}`),
    details: details.join(t('graph.node.labelSeparator'))
  })
}
