import { flattenPreorder } from '../graph/flattenPreorder'
import type { AgentGraphNode } from '../graph/agentGraphNode'
import { shareOfLargest } from '@renderer/components/shareOfLargest'
import { shareOfTotal } from '@renderer/components/shareOfTotal'

/** How many agents the Most tokens card lists. */
const TOP_COUNT = 6

/** One agent of the Most tokens card. */
export interface TopAgent {
  /** The agent's node. */
  readonly node: AgentGraphNode
  /** The agent's tokens. */
  readonly tokens: number
  /** The tokens against the top agent's, from 0 to 1, for the row's bar. */
  readonly bar: number
  /** The agent's share of the team total as a whole percent, at most 100, or `null` when there is no total to take it of. */
  readonly share: number | null
}

/**
 * Ranks the agents of a graph by their own tokens. Workflow runs, which only
 * group their agents, and agents without tokens are left out.
 *
 * @param root - The graph's root.
 * @param teamTotal - The session's total tokens, or `null` when unknown.
 * @returns The top agents, largest first, ties in the graph's preorder.
 */
export function topAgents(root: AgentGraphNode, teamTotal: number | null): readonly TopAgent[] {
  const ranked = flattenPreorder(root)
    .nodes.flatMap((node) =>
      node.kind !== 'workflow' && node.tokens !== null && node.tokens > 0
        ? [{ node, tokens: node.tokens }]
        : []
    )
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, TOP_COUNT)
  const largest = ranked[0]?.tokens ?? 0

  return ranked.map(({ node, tokens }) => ({
    node,
    tokens,
    bar: shareOfLargest(tokens, largest),
    share:
      teamTotal !== null && teamTotal > 0 ? Math.min(100, shareOfTotal(tokens, teamTotal)) : null
  }))
}
