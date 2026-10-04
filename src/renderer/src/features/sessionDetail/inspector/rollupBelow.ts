import type { AgentGraphNode } from '../graph/agentGraphNode'
import { flattenPreorder } from '../graph/flattenPreorder'

/** What the agents below a node add up to. */
export interface Rollup {
  /** The tokens of the agents below, not counting the node's own. */
  readonly tokens: number
  /** How many agents are below, at any depth. */
  readonly below: number
  /** Whether some agent below has no tokens recorded or a partial total, so `tokens` may be low. */
  readonly incomplete: boolean
}

/**
 * Adds up the tokens of every agent below a node. A teammate's own session
 * node carries its session's recorded total, which already covers its
 * subagents, so the subagents grafted under it are counted as agents below
 * but their tokens are not added a second time. The node itself is not
 * treated that way: its own tokens are shown separately, and its subagents are
 * added to them. It walks the tree without recursing.
 *
 * @param node - The node whose subtree to add up.
 * @returns The tokens below, how many agents that is, and whether the sum may be low.
 */
export function rollupBelow(node: AgentGraphNode): Rollup {
  const { nodes, parents } = flattenPreorder(node)
  const covered: boolean[] = []
  let tokens = 0
  let incomplete = false

  for (let i = 1; i < nodes.length; i += 1) {
    const parentIndex = parents[i] ?? 0
    const parent = nodes[parentIndex]
    const parentCovers = parentIndex !== 0 && parent?.selection?.kind === 'teammate'
    covered[i] = (covered[parentIndex] ?? false) || parentCovers
    const below = nodes[i]
    if (below === undefined || covered[i]) continue
    if (below.tokens === null) incomplete = true
    else tokens += below.tokens
    if (below.partial) incomplete = true
  }
  return { tokens, below: nodes.length - 1, incomplete }
}
