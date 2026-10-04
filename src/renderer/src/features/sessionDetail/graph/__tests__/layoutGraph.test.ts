import { describe, expect, it } from 'vitest'
import type { AgentGraphNode } from '../agentGraphNode'
import {
  COLUMN_WIDTH,
  LEAF_PITCH,
  NODE_HEIGHT,
  NODE_WIDTH,
  ORIGIN_X,
  ORIGIN_Y
} from '../graphMetrics'
import { layoutGraph } from '../layoutGraph'
import { testGraphNode } from '../testGraphNode'

/** Where each node sits, by key. */
function positions(root: AgentGraphNode): Record<string, { x: number; y: number; depth: number }> {
  const placed: Record<string, { x: number; y: number; depth: number }> = {}
  for (const { node, x, y, depth } of layoutGraph(root).nodes) placed[node.key] = { x, y, depth }
  return placed
}

describe('layoutGraph', () => {
  it('places a single node at the origin', () => {
    const layout = layoutGraph(testGraphNode('lead'))

    expect(layout.nodes.map(({ node, x, y, depth }) => [node.key, x, y, depth])).toEqual([
      ['lead', 28, 28, 0]
    ])
    expect(layout.edges).toEqual([])
  })

  it('sizes a single node with the origin margin on every side', () => {
    const layout = layoutGraph(testGraphNode('lead'))

    expect(layout.width).toBe(ORIGIN_X + NODE_WIDTH + ORIGIN_X)
    expect(layout.height).toBe(ORIGIN_Y + NODE_HEIGHT + ORIGIN_Y)
  })

  it('puts a chain in one row, a column per depth', () => {
    const chain = testGraphNode('a', {
      children: [testGraphNode('b', { children: [testGraphNode('c')] })]
    })

    const placed = positions(chain)

    expect(placed).toEqual({
      a: { x: 28, y: 28, depth: 0 },
      b: { x: 28 + COLUMN_WIDTH, y: 28, depth: 1 },
      c: { x: 28 + 2 * COLUMN_WIDTH, y: 28, depth: 2 }
    })
  })

  it('stacks leaves at the leaf pitch and centers the root on them', () => {
    const root = testGraphNode('root', {
      children: [testGraphNode('a'), testGraphNode('b'), testGraphNode('c')]
    })

    const placed = positions(root)

    expect([placed['a']?.y, placed['b']?.y, placed['c']?.y]).toEqual([28, 28 + 76, 28 + 152])
    expect(placed['root']?.y).toBe(28 + 76)
  })

  it('keeps leaves of uneven subtrees at a strict pitch, with no two nodes overlapping', () => {
    const root = testGraphNode('root', {
      children: [
        testGraphNode('left', { children: [testGraphNode('l1'), testGraphNode('l2')] }),
        testGraphNode('right', {
          children: [testGraphNode('r1', { children: [testGraphNode('r2')] })]
        }),
        testGraphNode('solo')
      ]
    })

    const layout = layoutGraph(root)

    const leafYs = layout.nodes.filter(({ node }) => node.children.length === 0).map(({ y }) => y)
    expect(leafYs).toEqual([28, 104, 180, 256])
    const byColumn = new Map<number, number[]>()
    for (const { x, y } of layout.nodes) byColumn.set(x, [...(byColumn.get(x) ?? []), y])
    for (const ys of byColumn.values()) {
      const sorted = [...ys].sort((a, b) => a - b)
      sorted.slice(1).forEach((y, i) => {
        expect(y - (sorted[i] ?? 0)).toBeGreaterThanOrEqual(LEAF_PITCH)
      })
    }
  })

  it('centers a parent on its first and last child, not its middle one', () => {
    const root = testGraphNode('root', {
      children: [
        testGraphNode('a'),
        testGraphNode('b'),
        testGraphNode('c', {
          children: [testGraphNode('c1'), testGraphNode('c2'), testGraphNode('c3')]
        })
      ]
    })

    const placed = positions(root)

    expect([placed['a']?.y, placed['b']?.y, placed['c']?.y]).toEqual([28, 104, 256])
    expect(placed['root']?.y).toBe((28 + 256) / 2)
  })

  it('draws an elbow from the parent’s right middle to the child’s left middle', () => {
    const root = testGraphNode('root', { children: [testGraphNode('a'), testGraphNode('b')] })

    const { edges } = layoutGraph(root)

    expect(edges).toEqual([
      { from: 'root', to: 'a', path: 'M 216 97 H 238 V 59 H 260' },
      { from: 'root', to: 'b', path: 'M 216 97 H 238 V 135 H 260' }
    ])
  })

  it('bounds the canvas by the farthest column and the lowest leaf', () => {
    const root = testGraphNode('root', {
      children: [
        testGraphNode('a', { children: [testGraphNode('a1'), testGraphNode('a2')] }),
        testGraphNode('b')
      ]
    })

    const layout = layoutGraph(root)

    expect(layout.width).toBe(ORIGIN_X + 2 * COLUMN_WIDTH + NODE_WIDTH + ORIGIN_X)
    expect(layout.height).toBe(28 + 2 * 76 + NODE_HEIGHT + ORIGIN_Y)
  })

  it('lists nodes in preorder, once each, with one edge per non-root node', () => {
    const root = testGraphNode('root', {
      children: [testGraphNode('a', { children: [testGraphNode('a1')] }), testGraphNode('b')]
    })

    const layout = layoutGraph(root)

    expect(layout.nodes.map(({ node }) => node.key)).toEqual(['root', 'a', 'a1', 'b'])
    expect(layout.edges.map(({ to }) => to)).toEqual(['a', 'a1', 'b'])
  })

  it('lays out two hundred nodes under one parent', () => {
    const leaves = Array.from({ length: 200 }, (_, i) => testGraphNode(`n${i}`))

    const layout = layoutGraph(testGraphNode('root', { children: leaves }))

    expect(layout.nodes).toHaveLength(201)
    expect(layout.nodes.at(-1)?.y).toBe(28 + 199 * 76)
    expect(layout.height).toBe(28 + 199 * 76 + NODE_HEIGHT + ORIGIN_Y)
  })

  it('lays out a chain tens of thousands deep without recursing', () => {
    let tail = testGraphNode('n0')
    for (let i = 1; i < 50_000; i += 1) tail = testGraphNode(`n${i}`, { children: [tail] })

    const layout = layoutGraph(tail)

    expect(layout.nodes).toHaveLength(50_000)
    expect(layout.nodes.at(-1)?.depth).toBe(49_999)
    expect(layout.width).toBe(ORIGIN_X + 49_999 * COLUMN_WIDTH + NODE_WIDTH + ORIGIN_X)
  })
})
