import { useCallback, useEffect, useRef } from 'react'
import type { RootAgentGraphNode } from './agentGraphNode'
import { focusGraphNode } from './focusGraphNode'
import { directionOfKey, graphNeighbor } from './graphNavigation'

/**
 * Moves focus among the graph's nodes on the arrow keys, Home and End, without
 * selecting them. An arrow key never scrolls the window while a node is
 * focused, even at the end of a branch, and an arrow pressed with Alt, Ctrl or
 * Cmd is left to the browser and the system, which use it for history and
 * shortcuts.
 *
 * @param root - The graph, which the move is looked up in.
 * @returns A key-down handler for a node's button. It reads the node from the button's `data-agent-key`, and keeps its identity as the graph changes, so the nodes it is passed to don't render again for it.
 */
export function useGraphKeyboard(
  root: RootAgentGraphNode
): (event: React.KeyboardEvent<HTMLButtonElement>) => void {
  const rootRef = useRef(root)
  useEffect(() => {
    rootRef.current = root
  }, [root])

  return useCallback((event) => {
    const direction = directionOfKey(event.key)
    const from = event.currentTarget.dataset.agentKey
    if (direction === null || from === undefined || event.altKey || event.ctrlKey || event.metaKey)
      return
    event.preventDefault()
    const target = graphNeighbor(rootRef.current, from, direction)
    if (target !== null) focusGraphNode(event.currentTarget, target)
  }, [])
}
