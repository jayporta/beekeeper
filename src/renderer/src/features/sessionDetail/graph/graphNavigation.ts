import type { AgentGraphNode, AgentKey } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'

/** Where a key press moves focus: along the spawn tree, or to its ends. */
export type GraphDirection = 'parent' | 'child' | 'previous' | 'next' | 'first' | 'last'

const KEY_DIRECTIONS: ReadonlyMap<string, GraphDirection> = new Map([
  ['ArrowLeft', 'parent'],
  ['ArrowRight', 'child'],
  ['ArrowUp', 'previous'],
  ['ArrowDown', 'next'],
  ['Home', 'first'],
  ['End', 'last']
])

/**
 * Reads the direction a key moves focus in.
 *
 * @param key - A `KeyboardEvent` key.
 * @returns The direction, or `null` for a key the graph leaves to the browser, such as Enter and Space.
 */
export function directionOfKey(key: string): GraphDirection | null {
  return KEY_DIRECTIONS.get(key) ?? null
}

/**
 * Finds where a direction leads from a node. Left goes to the parent and
 * right to the first child, up and down to the previous and next sibling, Home
 * to the root, and End to the last node in preorder. Siblings share a parent:
 * the graph never steps between cousins, and never wraps at an end.
 *
 * @param root - The graph's root.
 * @param key - The key of the node to move from.
 * @param direction - Where to move.
 * @returns The key of the node to move to, or `null` when there is nowhere to go, or `key` isn't in the graph.
 */
export function graphNeighbor(
  root: AgentGraphNode,
  key: string,
  direction: GraphDirection
): AgentKey | null {
  const { nodes, parents } = flattenPreorder(root)
  const index = nodes.findIndex((node) => node.key === key)
  const node = nodes[index]
  if (node === undefined) return null

  switch (direction) {
    case 'first':
      return root.key
    case 'last':
      return nodes.at(-1)?.key ?? null
    case 'child':
      return node.children[0]?.key ?? null
    case 'parent': {
      const parent = nodes[parents[index] ?? -1]
      return parent?.key ?? null
    }
    case 'previous':
    case 'next': {
      const siblings = nodes[parents[index] ?? -1]?.children ?? []
      const at = siblings.findIndex((sibling) => sibling.key === key)
      return siblings[direction === 'next' ? at + 1 : at - 1]?.key ?? null
    }
  }
}
