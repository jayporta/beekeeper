import type { PaneNode } from './paneView'

/** One row of the flattened tree: a node and how deep it sits. */
export interface PaneTreeRow {
  /** The node. */
  readonly node: PaneNode
  /** How many ancestors it has. */
  readonly depth: number
}

/**
 * Lists a tree's nodes in reading order, each with its depth.
 *
 * @param root - The tree's root.
 * @returns The rows, parents before their children.
 */
export function flattenPaneTree(root: PaneNode): readonly PaneTreeRow[] {
  const rows: PaneTreeRow[] = []
  const visit = (node: PaneNode, depth: number): void => {
    rows.push({ node, depth })
    for (const child of node.children) visit(child, depth + 1)
  }
  visit(root, 0)
  return rows
}
