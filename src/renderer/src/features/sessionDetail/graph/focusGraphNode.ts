/**
 * Moves focus to another node of the graph the focused node sits in.
 *
 * @param from - A node's button, or anything inside the graph.
 * @param key - The key of the node to focus.
 */
export function focusGraphNode(from: Element, key: string): void {
  const nodes =
    from.closest('[role="region"]')?.querySelectorAll<HTMLElement>('[data-agent-key]') ?? []
  for (const node of nodes) {
    if (node.dataset.agentKey === key) {
      node.focus()
      return
    }
  }
}
