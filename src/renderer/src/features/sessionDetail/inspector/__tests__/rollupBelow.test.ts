import { describe, expect, it } from 'vitest'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testGraphNode } from '../../graph/testGraphNode'
import { rollupBelow } from '../rollupBelow'

type GraphNode = ReturnType<typeof testGraphNode>

const tokens = (n: number | null, partial = false): Parameters<typeof testGraphNode>[1] => ({
  tokens: n,
  partial
})
const teammate = (n: number | null, children: GraphNode[] = []): GraphNode =>
  testGraphNode('mate:x', {
    kind: 'teammate',
    tokens: n,
    selection: { kind: 'teammate', ref: testRef(2) },
    children
  })

describe('rollupBelow', () => {
  it('has nothing below a leaf', () => {
    expect(rollupBelow(testGraphNode('a', tokens(5)))).toEqual({
      tokens: 0,
      below: 0,
      incomplete: false
    })
  })

  it('sums the tokens of every agent below and counts them', () => {
    const root = testGraphNode('lead', {
      children: [
        testGraphNode('a', { ...tokens(10), children: [testGraphNode('a1', tokens(1))] }),
        testGraphNode('b', tokens(100))
      ]
    })

    expect(rollupBelow(root)).toEqual({ tokens: 111, below: 3, incomplete: false })
  })

  it('does not count the node’s own tokens', () => {
    const root = testGraphNode('lead', {
      ...tokens(1000),
      children: [testGraphNode('a', tokens(7))]
    })

    expect(rollupBelow(root).tokens).toBe(7)
  })

  it('is incomplete when an agent below has no tokens recorded', () => {
    const root = testGraphNode('lead', { children: [testGraphNode('a', tokens(null))] })

    expect(rollupBelow(root)).toEqual({ tokens: 0, below: 1, incomplete: true })
  })

  it('is incomplete when an agent below is partial', () => {
    const root = testGraphNode('lead', { children: [testGraphNode('a', tokens(5, true))] })

    expect(rollupBelow(root)).toEqual({ tokens: 5, below: 1, incomplete: true })
  })

  it('counts a teammate’s recorded total once, not its subagents again', () => {
    const root = testGraphNode('lead', {
      children: [
        teammate(500, [testGraphNode('w1', tokens(200)), testGraphNode('w2', tokens(100))])
      ]
    })

    expect(rollupBelow(root)).toEqual({ tokens: 500, below: 3, incomplete: false })
  })

  it('leaves out the tokens of every depth under a teammate, not only its children', () => {
    const root = testGraphNode('lead', {
      children: [
        teammate(500, [
          testGraphNode('w1', { ...tokens(200), children: [testGraphNode('w2', tokens(300))] })
        ])
      ]
    })

    expect(rollupBelow(root)).toEqual({ tokens: 500, below: 3, incomplete: false })
  })

  it('does not let an incomplete agent under a teammate make the rollup incomplete', () => {
    const root = testGraphNode('lead', {
      children: [teammate(500, [testGraphNode('w1', tokens(null, true))])]
    })

    expect(rollupBelow(root).incomplete).toBe(false)
  })

  it('adds the subagents of a selected teammate to its own tokens, since the node itself is not covered', () => {
    const selected = teammate(300, [testGraphNode('w1', tokens(40))])

    expect(rollupBelow(selected)).toEqual({ tokens: 40, below: 1, incomplete: false })
  })

  it('sums a chain thousands deep without recursing', () => {
    let tail = testGraphNode('n0', tokens(1))
    for (let i = 1; i < 5000; i += 1) {
      tail = testGraphNode(`n${i}`, { ...tokens(1), children: [tail] })
    }

    expect(rollupBelow(tail)).toEqual({ tokens: 4999, below: 4999, incomplete: false })
  })
})
