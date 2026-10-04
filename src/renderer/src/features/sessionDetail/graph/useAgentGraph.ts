import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionDetailDto } from '../../../../../shared/ipc/sessionDetailDto'
import type { SessionRefDto } from '../../../../../shared/ipc/sessionRefDto'
import type { SessionRow } from '@renderer/features/sessions/sessionRow'
import type { RootAgentGraphNode } from './agentGraphNode'
import { buildAgentGraph } from './buildAgentGraph'
import { layoutGraph, type GraphLayout } from './layoutGraph'

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
interface AgentGraph {
  /** The model, rooted at the viewed agent. */
  readonly root: RootAgentGraphNode
  /** The model placed on a canvas. */
  readonly layout: GraphLayout
}

/**
 * Builds a session's agent graph and lays it out. Both steps are memoized on
 * their inputs, so a render that changes neither, such as a selection change,
 * reuses the same nodes and positions.
 *
 * @param input - The session's detail, ref, and list row.
 * @returns The model and its layout.
 */
export function useAgentGraph(input: UseAgentGraphInput): AgentGraph {
  const { detail, sessionRef, row } = input
  const { t } = useTranslation('sessionDetail')
  const root = useMemo(
    () =>
      buildAgentGraph({ detail, ref: sessionRef, rootItem: row?.item ?? null, rootRow: row, t }),
    [detail, sessionRef, row, t]
  )
  const layout = useMemo(() => layoutGraph(root), [root])
  return { root, layout }
}
