/** A tree laid out as parallel arrays in preorder, so a pass over it needs no recursion. */
export interface FlatTree<T> {
  /** Every node, each before its descendants and its first child before its second. */
  readonly nodes: readonly T[]
  /** Each node's distance from the root, by index in `nodes`. */
  readonly depths: readonly number[]
  /** Each node's parent's index in `nodes`, by index. `-1` for the root. */
  readonly parents: readonly number[]
}

/**
 * Flattens a tree in preorder without recursing, so a tree built from
 * untrusted data can be arbitrarily deep. Reading the result backward visits
 * every node after all of its descendants.
 *
 * @param root - The tree's root.
 * @returns The nodes with their depths and parent indexes.
 */
export function flattenPreorder<T extends { readonly children: readonly T[] }>(
  root: T
): FlatTree<T> {
  const nodes: T[] = []
  const depths: number[] = []
  const parents: number[] = []
  const pending = [{ node: root, depth: 0, parent: -1 }]

  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const index = nodes.length
    nodes.push(next.node)
    depths.push(next.depth)
    parents.push(next.parent)
    for (let i = next.node.children.length - 1; i >= 0; i -= 1) {
      const child = next.node.children[i]
      if (child !== undefined) pending.push({ node: child, depth: next.depth + 1, parent: index })
    }
  }

  return { nodes, depths, parents }
}
