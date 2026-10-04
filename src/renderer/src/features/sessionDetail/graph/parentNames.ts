import type { AgentKey } from './agentGraphNode'
import type { GraphLayout } from './layoutGraph'

/**
 * Finds each node's parent's name, which a node's accessible name carries
 * because the edges that show the hierarchy are hidden from assistive
 * technology.
 *
 * @param layout - The placed graph.
 * @returns The parent's name by node key. The root has no entry. Transcript-derived: render as plain text.
 */
export function parentNames(layout: GraphLayout): ReadonlyMap<AgentKey, string> {
  const names = new Map(layout.nodes.map(({ node }) => [node.key, node.name]))
  const parents = new Map<AgentKey, string>()
  for (const { from, to } of layout.edges) {
    const name = names.get(from)
    if (name !== undefined) parents.set(to, name)
  }
  return parents
}
