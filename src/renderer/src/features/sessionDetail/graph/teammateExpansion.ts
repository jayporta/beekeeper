import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { AgentGraphNode, AgentKey, RootAgentGraphNode } from './agentGraphNode'
import { buildSubagentNodes } from './subagentNodes'

/** How loading a teammate's own session is going. */
export type TeammateExpansion =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'ready'
      /** The teammate's own subagents, to hang under its node. */
      readonly children: readonly AgentGraphNode[]
      /** Whether the teammate's subagents folder couldn't be read, so `children` may be missing some. */
      readonly partial: boolean
    }

/**
 * Reads how a teammate's session load stands. A detail that arrived wins over
 * a failed refresh, so a teammate stays expanded once loaded.
 *
 * @param query - The teammate's detail query: its data, and whether the last load failed.
 * @param ref - The teammate's own session, which owns the subagents it holds.
 * @returns The expansion.
 */
export function expansionOf(
  query: { readonly data: SessionDetailDto | undefined; readonly isError: boolean },
  ref: SessionRefDto
): TeammateExpansion {
  if (query.data === undefined) return { status: query.isError ? 'error' : 'loading' }
  return {
    status: 'ready',
    children: buildSubagentNodes(query.data, ref),
    partial: !query.data.subagents.ok
  }
}

/**
 * Hangs each expanded teammate's subagents under its node. A teammate whose
 * load failed is marked partial, and one still loading is left as it was. The
 * root comes back as is when nothing is expanded, so a memoized layout of it
 * stays valid.
 *
 * @param root - The graph, with its teammates' nodes childless.
 * @param expansions - Each expanded teammate's load, by node key.
 * @returns The graph with the expansions applied.
 */
export function graftTeammates(
  root: RootAgentGraphNode,
  expansions: ReadonlyMap<AgentKey, TeammateExpansion>
): RootAgentGraphNode {
  if (expansions.size === 0) return root

  const children = root.children.map((child) => {
    const expansion = expansions.get(child.key)
    if (expansion === undefined || expansion.status === 'loading') return child
    if (expansion.status === 'error') return { ...child, partial: true }
    return { ...child, children: expansion.children, partial: child.partial || expansion.partial }
  })
  return { ...root, children }
}
