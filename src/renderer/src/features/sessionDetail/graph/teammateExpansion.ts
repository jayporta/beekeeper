import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { sessionKey } from '@renderer/features/sessions/sessionKey'
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

const LOADING: TeammateExpansion = { status: 'loading' }
const ERRORED: TeammateExpansion = { status: 'error' }

/** Each loaded detail's expansion, by the teammate session it was read for. A detail the query drops takes its entry with it. */
const readyExpansions = new WeakMap<SessionDetailDto, Map<string, TeammateExpansion>>()

/**
 * Reads how a teammate's session load stands. A detail that arrived wins over
 * a failed refresh, so a teammate stays expanded once loaded. The same detail
 * for the same teammate gives back the same expansion, so its nodes keep their
 * identity while the detail does.
 *
 * @param query - The teammate's detail query: its data, and whether the last load failed.
 * @param ref - The teammate's own session, which owns the subagents it holds.
 * @returns The expansion.
 */
export function expansionOf(
  query: { readonly data: SessionDetailDto | undefined; readonly isError: boolean },
  ref: SessionRefDto
): TeammateExpansion {
  const { data } = query
  if (data === undefined) return query.isError ? ERRORED : LOADING
  const forTeammates = readyExpansions.get(data) ?? new Map<string, TeammateExpansion>()
  readyExpansions.set(data, forTeammates)
  const key = sessionKey(ref)
  const known = forTeammates.get(key)
  if (known !== undefined) return known
  const expansion: TeammateExpansion = {
    status: 'ready',
    children: buildSubagentNodes(data, ref),
    partial: !data.subagents.ok
  }
  forTeammates.set(key, expansion)
  return expansion
}

/**
 * Hangs each expanded teammate's subagents under its node. A teammate whose
 * load failed is marked partial, and one still loading is left as it was. A
 * loaded teammate no longer has subagents missing from the graph. The root
 * comes back as is when no expansion changes a node, such as when nothing is
 * expanded or every expanded teammate is still loading, so a memoized layout
 * of it stays valid.
 *
 * @param root - The graph, with its teammates' nodes childless.
 * @param expansions - Each expanded teammate's load, by node key.
 * @returns The graph with the expansions applied.
 */
export function graftTeammates(
  root: RootAgentGraphNode,
  expansions: ReadonlyMap<AgentKey, TeammateExpansion>
): RootAgentGraphNode {
  let changed = false
  const children = root.children.map((child) => {
    const expansion = expansions.get(child.key)
    if (expansion === undefined || expansion.status === 'loading') return child
    if (expansion.status === 'error' && child.partial) return child
    changed = true
    if (expansion.status === 'error') return { ...child, partial: true }
    return {
      ...child,
      children: expansion.children,
      partial: child.partial || expansion.partial,
      subagentsNotLoaded: false
    }
  })
  return changed ? { ...root, children } : root
}
