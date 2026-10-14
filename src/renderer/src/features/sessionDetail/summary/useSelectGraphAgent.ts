import { useCallback, type RefObject } from 'react'
import { useNavigationStore } from '@renderer/features/navigation/state/useNavigationStore'
import type { AgentGraphNode } from '../../../../../shared/agentGraph/agentGraphNode'
import { focusGraphNode } from '../graph/focusGraphNode'

/**
 * Makes the handler a summary card's row calls to select an agent the way
 * pressing its graph node does, then move focus to that node, which scrolls
 * it into view.
 *
 * @param regionRef - The graph's region element, which holds the nodes.
 * @returns A function that selects the agent and focuses its node.
 */
export function useSelectGraphAgent(
  regionRef: RefObject<HTMLDivElement | null>
): (node: AgentGraphNode) => void {
  const selectAgent = useNavigationStore((state) => state.selectAgent)

  return useCallback(
    (node) => {
      selectAgent(node.selection)
      if (regionRef.current !== null) focusGraphNode(regionRef.current, node.key)
    },
    [selectAgent, regionRef]
  )
}
