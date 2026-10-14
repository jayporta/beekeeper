import { describe, expect, it } from 'vitest'
import { testGraphNode } from '../../../../../../shared/agentGraph/testGraphNode'
import { signalRanking } from '../signalRanking'

const marks = (
  toolErrors: number,
  longestErrorStreak = 0
): { toolErrors: number; compactions: number; longestErrorStreak: number } => ({
  toolErrors,
  compactions: 0,
  longestErrorStreak
})

describe('signalRanking', () => {
  it('ranks agents with tool errors, most first', () => {
    const tree = testGraphNode('lead', {
      kind: 'lead',
      marks: marks(1),
      children: [testGraphNode('a', { marks: marks(5) }), testGraphNode('b', { marks: marks(3) })]
    })

    expect(signalRanking(tree).map((node) => node.key)).toEqual(['a', 'b', 'lead'])
  })

  it('keeps preorder for equal counts', () => {
    const tree = testGraphNode('lead', {
      marks: marks(2),
      children: [testGraphNode('a', { marks: marks(2) })]
    })

    expect(signalRanking(tree).map((node) => node.key)).toEqual(['lead', 'a'])
  })

  it('leaves out agents with no tool errors, unknown marks, and workflow runs', () => {
    const tree = testGraphNode('lead', {
      marks: marks(0),
      children: [
        testGraphNode('unknown', { marks: null }),
        testGraphNode('run', { kind: 'workflow', marks: marks(9) })
      ]
    })

    expect(signalRanking(tree)).toEqual([])
  })
})
