import { describe, expect, it } from 'vitest'
import { directionOfKey, graphNeighbor } from '../graphNavigation'
import { testGraphNode } from '../testGraphNode'

const a1 = testGraphNode('a1')
const a2 = testGraphNode('a2')
const a = testGraphNode('a', [a1, a2])
const b = testGraphNode('b')
const c1 = testGraphNode('c1')
const c = testGraphNode('c', [c1])
const lead = testGraphNode('lead', [a, b, c])

describe('graphNeighbor', () => {
  it.each([
    ['a1', 'a'],
    ['a', 'lead'],
    ['c1', 'c']
  ])('goes from %s to its parent %s', (from, to) => {
    expect(graphNeighbor(lead, from, 'parent')).toBe(to)
  })

  it('has no parent to go to from the root', () => {
    expect(graphNeighbor(lead, 'lead', 'parent')).toBeNull()
  })

  it.each([
    ['lead', 'a'],
    ['a', 'a1'],
    ['c', 'c1']
  ])('goes from %s to its first child %s', (from, to) => {
    expect(graphNeighbor(lead, from, 'child')).toBe(to)
  })

  it('has no child to go to from a leaf', () => {
    expect(graphNeighbor(lead, 'b', 'child')).toBeNull()
  })

  it.each([
    ['a', 'b'],
    ['b', 'c'],
    ['a1', 'a2']
  ])('goes from %s to its next sibling %s', (from, to) => {
    expect(graphNeighbor(lead, from, 'next')).toBe(to)
  })

  it('has no next sibling after the last child', () => {
    expect(graphNeighbor(lead, 'c', 'next')).toBeNull()
    expect(graphNeighbor(lead, 'a2', 'next')).toBeNull()
  })

  it.each([
    ['c', 'b'],
    ['b', 'a'],
    ['a2', 'a1']
  ])('goes from %s to its previous sibling %s', (from, to) => {
    expect(graphNeighbor(lead, from, 'previous')).toBe(to)
  })

  it('has no previous sibling before the first child', () => {
    expect(graphNeighbor(lead, 'a', 'previous')).toBeNull()
    expect(graphNeighbor(lead, 'a1', 'previous')).toBeNull()
  })

  it('has no sibling to go to from the root', () => {
    expect(graphNeighbor(lead, 'lead', 'next')).toBeNull()
    expect(graphNeighbor(lead, 'lead', 'previous')).toBeNull()
  })

  it('does not step between cousins', () => {
    expect(graphNeighbor(lead, 'a2', 'next')).toBeNull()
    expect(graphNeighbor(lead, 'c1', 'previous')).toBeNull()
  })

  it.each(['lead', 'a1', 'c'])('goes from %s to the root for first', (from) => {
    expect(graphNeighbor(lead, from, 'first')).toBe('lead')
  })

  it.each(['lead', 'a', 'c1'])('goes from %s to the last node in preorder for last', (from) => {
    expect(graphNeighbor(lead, from, 'last')).toBe('c1')
  })

  it('goes nowhere from a key that is not in the graph', () => {
    expect(graphNeighbor(lead, 'missing', 'parent')).toBeNull()
    expect(graphNeighbor(lead, 'missing', 'first')).toBeNull()
  })

  it('walks a single node graph without finding anywhere to go', () => {
    const only = testGraphNode('lead')

    expect(
      (['parent', 'child', 'next', 'previous'] as const).map((d) => graphNeighbor(only, 'lead', d))
    ).toEqual([null, null, null, null])
    expect(graphNeighbor(only, 'lead', 'first')).toBe('lead')
    expect(graphNeighbor(only, 'lead', 'last')).toBe('lead')
  })

  it('walks a chain thousands deep without recursing', () => {
    let tail = testGraphNode('n0')
    for (let i = 1; i < 5000; i += 1) tail = testGraphNode(`n${i}`, [tail])

    expect(graphNeighbor(tail, 'n4999', 'last')).toBe('n0')
  })
})

describe('directionOfKey', () => {
  it.each([
    ['ArrowLeft', 'parent'],
    ['ArrowRight', 'child'],
    ['ArrowUp', 'previous'],
    ['ArrowDown', 'next'],
    ['Home', 'first'],
    ['End', 'last']
  ])('maps %s to %s', (key, direction) => {
    expect(directionOfKey(key)).toBe(direction)
  })

  it.each(['Enter', ' ', 'Tab', 'a', 'PageDown'])('leaves %j to the browser', (key) => {
    expect(directionOfKey(key)).toBeNull()
  })
})
