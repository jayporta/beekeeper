import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import type { AgentKey, RootAgentGraphNode } from './agentGraphNode'
import { buildAgentGraph } from './buildAgentGraph'
import { layoutGraph, type GraphLayout } from './layoutGraph'
import { selectedAgentKey } from './selectedAgentKey'
import { graftTeammates, type TeammateExpansion } from './teammateExpansion'
import { useTeammateExpansions } from './useTeammateExpansions'

/** Input for {@link useAgentGraph}. */
interface UseAgentGraphInput {
  /** The viewed session's agent tree and reports. */
  readonly detail: SessionDetailDto
  /** The viewed session. */
  readonly sessionRef: SessionRefDto
  /** The session's row in its folder's sessions list, or `null` when the list doesn't hold it. */
  readonly row: SessionRow | null
}

/** The graph model of a session and where each node sits. */
export interface AgentGraph {
  /** The model, rooted at the viewed agent, with the subagents of each opened teammate under it. */
  readonly root: RootAgentGraphNode
  /** The model placed on a canvas. */
  readonly layout: GraphLayout
  /** The teammates whose sessions are still loading. */
  readonly loading: ReadonlySet<AgentKey>
  /** How each opened teammate's load stands, by node key. */
  readonly expansions: ReadonlyMap<AgentKey, TeammateExpansion>
  /** The key of the selected node: the lead unless the selection names another node in the graph. */
  readonly selectedKey: AgentKey
}

/**
 * Builds a session's agent graph, adds the subagents of the teammates the
 * person has opened, and lays it out. Each step is memoized on its inputs, so
 * a render that changes none of them, such as a selection change that opens
 * no teammate, reuses the same nodes and positions.
 *
 * @param input - The session's detail, ref, and list row.
 * @returns The model, its layout, the teammates still loading, how each opened teammate's load stands, and the selected node's key.
 */
export function useAgentGraph(input: UseAgentGraphInput): AgentGraph {
  const { detail, sessionRef, row } = input
  const { t } = useTranslation('sessionDetail')
  const base = useMemo(
    () =>
      buildAgentGraph({ detail, ref: sessionRef, rootItem: row?.item ?? null, rootRow: row, t }),
    [detail, sessionRef, row, t]
  )
  const expansions = useTeammateExpansions(base)
  const root = useMemo(() => graftTeammates(base, expansions), [base, expansions])
  const layout = useMemo(() => layoutGraph(root), [root])
  const loading = useMemo(
    () =>
      new Set([...expansions].filter(([, { status }]) => status === 'loading').map(([key]) => key)),
    [expansions]
  )
  const selectedAgent = useNavigationStore((state) => state.selectedAgent)
  const selectedKey = useMemo(
    () =>
      selectedAgentKey(
        layout.nodes.map(({ node }) => node),
        selectedAgent
      ),
    [layout, selectedAgent]
  )
  return { root, layout, loading, expansions, selectedKey }
}
