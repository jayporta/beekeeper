import type { AgentKey } from './agentGraphNode'
import type { GraphT } from './graphT'
import type { GraphLayout } from './layoutGraph'
import { workflowLabel } from './workflowLabel'

/**
 * Finds each node's parent's name, which a node's accessible name carries
 * because the edges that show the hierarchy are hidden from assistive
 * technology. A parent run whose name another run shares carries its id too.
 *
 * @param layout - The placed graph.
 * @param t - The graph translate function.
 * @returns The parent's name by node key. The root has no entry. Transcript-derived: render as plain text.
 */
export function parentNames(layout: GraphLayout, t: GraphT): ReadonlyMap<AgentKey, string> {
  const names = new Map(
    layout.nodes.map(({ node }) => [
      node.key,
      node.kind === 'workflow' && node.workflow !== null
        ? workflowLabel(node.workflow, t)
        : node.name
    ])
  )
  const parents = new Map<AgentKey, string>()
  for (const { from, to } of layout.edges) {
    const name = names.get(from)
    if (name !== undefined) parents.set(to, name)
  }
  return parents
}
