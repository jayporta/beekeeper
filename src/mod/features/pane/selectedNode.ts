import type { PaneNode, PaneView } from './paneView'
import { flattenPaneTree } from './paneTree'

/** What the person selected: the session and the node's key. */
export interface PaneSelection {
  /** The session the selection was made in. */
  readonly sessionId: string
  /** The selected node's key. */
  readonly key: string
}

/**
 * The node the pane shows as selected: the one the stored selection names when it was made in
 * this view's session and the node is still in the tree, otherwise the root.
 *
 * @param view - A view with a tree.
 * @param selected - The stored selection, or `null` for none.
 * @returns The selected node, or `null` when the view has no tree.
 */
export function selectedNode(view: PaneView, selected: PaneSelection | null): PaneNode | null {
  if (view.root === null) return null
  const chosen = selected?.sessionId === view.sessionId ? selected.key : view.root.key
  return flattenPaneTree(view.root).find(({ node }) => node.key === chosen)?.node ?? view.root
}
