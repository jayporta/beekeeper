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
  /** Whether some agent below may have subagents that aren't loaded, so `tokens` and `below` may be low. */
  readonly subagentsNotLoaded: boolean
}

/**
 * Adds up the tokens of every agent below a node, not counting the node's
 * own. Each node's tokens cover its own transcript only, a teammate's
 * included, so the subagents under a teammate add theirs. A teammate whose
 * subagents aren't loaded adds none, which the result says. The node's own
 * mark doesn't count: an inspected teammate is open, so its subagents are
 * loaded by the time it has totals. A workflow run groups agents that are
 * counted themselves, so the run node adds nothing. It walks the tree without
 * recursing.
 *
 * @param node - The node whose subtree to add up.
 * @returns The tokens below, how many agents that is, and whether the sum may be low or leaves out unloaded subagents.
 */
export function rollupBelow(node: AgentGraphNode): Rollup {
  const { nodes } = flattenPreorder(node)
  let tokens = 0
  let incomplete = false
  let subagentsNotLoaded = false
  let counted = 0

  for (let i = 1; i < nodes.length; i += 1) {
    const below = nodes[i]
    if (below === undefined || below.kind === 'workflow') continue
    counted += 1
    if (below.tokens === null) incomplete = true
    else tokens += below.tokens
    if (below.partial) incomplete = true
    if (below.subagentsNotLoaded) subagentsNotLoaded = true
  }
  return { tokens, below: counted, incomplete, subagentsNotLoaded }
}
