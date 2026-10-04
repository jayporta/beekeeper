import type { AgentGraphNode, AgentKey } from './agentGraphNode'
import { flattenPreorder } from './flattenPreorder'
import {
  COLUMN_WIDTH,
  LEAF_PITCH,
  NODE_HEIGHT,
  NODE_WIDTH,
  ORIGIN_X,
  ORIGIN_Y
} from './graphMetrics'

/** A node placed on the canvas. */
export interface PlacedNode {
  /** The node. */
  readonly node: AgentGraphNode
  /** The left edge, in pixels. */
  readonly x: number
  /** The top edge, in pixels. */
  readonly y: number
  /** The node's distance from the root. */
  readonly depth: number
}

/** The elbow joining a parent to one child. */
export interface GraphEdge {
  /** The parent's key. */
  readonly from: AgentKey
  /** The child's key. */
  readonly to: AgentKey
  /** An SVG path from the parent's right middle to the child's left middle. */
  readonly path: string
}

/** The graph placed on a canvas of known size. */
export interface GraphLayout {
  /** Every node, in preorder. */
  readonly nodes: readonly PlacedNode[]
  /** One edge per node but the root, in preorder of the child. */
  readonly edges: readonly GraphEdge[]
  /** The canvas width that holds every node and its margin, in pixels. */
  readonly width: number
  /** The canvas height that holds every node and its margin, in pixels. */
  readonly height: number
}

/** A node while its row is being worked out. */
interface Slot {
  readonly node: AgentGraphNode
  readonly depth: number
  readonly parent: Slot | null
  firstChild: Slot | null
  lastChild: Slot | null
  y: number
}

/**
 * Places a spawn graph as a tidy tree running left to right. A column holds
 * one depth. Leaves stack at a fixed pitch from the top, and each parent
 * sits at the midpoint of its first and last child. The pass is iterative and
 * linear in the number of nodes, so a deep or wide graph is no harder than a
 * small one.
 *
 * @param root - The graph's root.
 * @returns Each node's position, the edges between them, and the canvas size.
 */
export function layoutGraph(root: AgentGraphNode): GraphLayout {
  const flat = flattenPreorder(root)
  const slots: Slot[] = []
  flat.nodes.forEach((node, i) => {
    const parentIndex = flat.parents[i] ?? -1
    const parent = parentIndex < 0 ? null : (slots[parentIndex] ?? null)
    const slot: Slot = {
      node,
      depth: flat.depths[i] ?? 0,
      parent,
      firstChild: null,
      lastChild: null,
      y: 0
    }
    if (parent !== null) {
      parent.firstChild ??= slot
      parent.lastChild = slot
    }
    slots.push(slot)
  })

  let nextLeafY = ORIGIN_Y
  for (const slot of slots) {
    if (slot.firstChild !== null) continue
    slot.y = nextLeafY
    nextLeafY += LEAF_PITCH
  }
  // A parent comes before its children in preorder, so going backward places every child first.
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    const slot = slots[i]
    if (slot === undefined || slot.firstChild === null || slot.lastChild === null) continue
    slot.y = (slot.firstChild.y + slot.lastChild.y) / 2
  }

  const lastLeafY = nextLeafY - LEAF_PITCH
  const x = (slot: Slot): number => ORIGIN_X + slot.depth * COLUMN_WIDTH
  const nodes: PlacedNode[] = []
  const edges: GraphEdge[] = []
  let maxDepth = 0
  for (const slot of slots) {
    nodes.push({ node: slot.node, x: x(slot), y: slot.y, depth: slot.depth })
    maxDepth = Math.max(maxDepth, slot.depth)
    if (slot.parent === null) continue
    const startX = x(slot.parent) + NODE_WIDTH
    const startY = slot.parent.y + NODE_HEIGHT / 2
    const endX = x(slot)
    const endY = slot.y + NODE_HEIGHT / 2
    const midX = startX + (endX - startX) / 2
    edges.push({
      from: slot.parent.node.key,
      to: slot.node.key,
      path: `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
    })
  }

  return {
    nodes,
    edges,
    width: ORIGIN_X + maxDepth * COLUMN_WIDTH + NODE_WIDTH + ORIGIN_X,
    height: lastLeafY + NODE_HEIGHT + ORIGIN_Y
  }
}
