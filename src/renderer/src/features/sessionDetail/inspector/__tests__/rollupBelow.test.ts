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
      incomplete: false,
      subagentsNotLoaded: false
    })
  })

  it('sums the tokens of every agent below and counts them', () => {
    const root = testGraphNode('lead', {
      children: [
        testGraphNode('a', { ...tokens(10), children: [testGraphNode('a1', tokens(1))] }),
        testGraphNode('b', tokens(100))
      ]
    })

    expect(rollupBelow(root)).toEqual({
      tokens: 111,
      below: 3,
      incomplete: false,
      subagentsNotLoaded: false
    })
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

    expect(rollupBelow(root)).toEqual({
      tokens: 0,
      below: 1,
      incomplete: true,
      subagentsNotLoaded: false
    })
  })

  it('is incomplete when an agent below is partial', () => {
    const root = testGraphNode('lead', { children: [testGraphNode('a', tokens(5, true))] })

    expect(rollupBelow(root)).toEqual({
      tokens: 5,
      below: 1,
      incomplete: true,
      subagentsNotLoaded: false
    })
  })

  it('adds the subagents under a teammate to its tokens, since its total is its own transcript only', () => {
    const root = testGraphNode('lead', {
      children: [
        teammate(500, [
          testGraphNode('w1', { ...tokens(200), children: [testGraphNode('w2', tokens(300))] })
        ])
      ]
    })

    expect(rollupBelow(root)).toEqual({
      tokens: 1000,
      below: 3,
      incomplete: false,
      subagentsNotLoaded: false
    })
  })

  it('is incomplete when an agent under a teammate has no tokens recorded', () => {
    const root = testGraphNode('lead', {
      children: [teammate(500, [testGraphNode('w1', tokens(null))])]
    })

    expect(rollupBelow(root)).toEqual({
      tokens: 500,
      below: 2,
      incomplete: true,
      subagentsNotLoaded: false
    })
  })

  it('flags that subagents are not loaded when a teammate below has some it does not hold', () => {
    const root = testGraphNode('lead', {
      children: [testGraphNode('mate:x', { ...tokens(500), subagentsNotLoaded: true })]
    })

    expect(rollupBelow(root)).toMatchObject({ below: 1, subagentsNotLoaded: true })
  })

  it('flags it for an unloaded teammate nested deeper', () => {
    const root = testGraphNode('lead', {
      children: [
        testGraphNode('a', { children: [testGraphNode('mate:x', { subagentsNotLoaded: true })] })
      ]
    })

    expect(rollupBelow(root).subagentsNotLoaded).toBe(true)
  })

  it('does not flag it for the node’s own mark, since only the agents below add to its total', () => {
    const root = testGraphNode('mate:x', {
      subagentsNotLoaded: true,
      children: [testGraphNode('w1', tokens(5))]
    })

    expect(rollupBelow(root).subagentsNotLoaded).toBe(false)
  })

  it('does not flag it when every agent below has its subagents loaded', () => {
    const root = testGraphNode('lead', {
      children: [teammate(500, [testGraphNode('w1', tokens(5))])]
    })

    expect(rollupBelow(root).subagentsNotLoaded).toBe(false)
  })

  it('sums a chain thousands deep without recursing', () => {
    let tail = testGraphNode('n0', tokens(1))
    for (let i = 1; i < 5000; i += 1) {
      tail = testGraphNode(`n${i}`, { ...tokens(1), children: [tail] })
    }

    expect(rollupBelow(tail)).toEqual({
      tokens: 4999,
      below: 4999,
      incomplete: false,
      subagentsNotLoaded: false
    })
  })
})
