import { describe, expect, it } from 'vitest'
import { layoutGraph } from '../layoutGraph'
import { parentNames } from '../parentNames'
import { testGraphNode } from '../testGraphNode'

describe('parentNames', () => {
  it('names each node’s parent, and leaves the root out', () => {
    const root = testGraphNode('lead', {
      name: 'Lead',
      kind: 'lead',
      children: [
        testGraphNode('mate', {
          name: 'writer',
          kind: 'teammate',
          children: [testGraphNode('deep', { name: 'drafter' })]
        }),
        testGraphNode('sub', { name: 'scout' })
      ]
    })

    const names = parentNames(layoutGraph(root))

    expect([...names]).toEqual([
      ['mate', 'Lead'],
      ['deep', 'writer'],
      ['sub', 'Lead']
    ])
  })

  it('is empty for a graph of one node', () => {
    expect(parentNames(layoutGraph(testGraphNode('lead'))).size).toBe(0)
  })
})
