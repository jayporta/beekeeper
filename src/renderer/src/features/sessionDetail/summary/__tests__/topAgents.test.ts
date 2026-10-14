import { describe, expect, it } from 'vitest'
import { testGraphNode } from '../../../../../../shared/agentGraph/testGraphNode'
import { topAgents } from '../topAgents'

const root = (...children: ReturnType<typeof testGraphNode>[]): ReturnType<typeof testGraphNode> =>
  testGraphNode('lead', { kind: 'lead', tokens: 100, children })

describe('topAgents', () => {
  it('ranks agents by tokens, largest first', () => {
    const rows = topAgents(root(testGraphNode('a', { tokens: 300 })), null)

    expect(rows.map((row) => row.node.key)).toEqual(['a', 'lead'])
  })

  it('keeps preorder for equal tokens', () => {
    const rows = topAgents(
      root(testGraphNode('a', { tokens: 100 }), testGraphNode('b', { tokens: 100 })),
      null
    )

    expect(rows.map((row) => row.node.key)).toEqual(['lead', 'a', 'b'])
  })

  it('leaves out agents without tokens and workflow runs', () => {
    const rows = topAgents(
      root(
        testGraphNode('none', { tokens: null }),
        testGraphNode('zero', { tokens: 0 }),
        testGraphNode('run', { kind: 'workflow', tokens: 999 })
      ),
      null
    )

    expect(rows.map((row) => row.node.key)).toEqual(['lead'])
  })

  it('keeps the agents inside a workflow run', () => {
    const run = testGraphNode('run', {
      kind: 'workflow',
      children: [testGraphNode('member', { tokens: 5 })]
    })

    expect(topAgents(root(run), null).map((row) => row.node.key)).toContain('member')
  })

  it('stops at six', () => {
    const children = Array.from({ length: 9 }, (_, i) =>
      testGraphNode(`n${i}`, { tokens: 200 + i })
    )

    expect(topAgents(root(...children), null)).toHaveLength(6)
  })

  it('sizes each bar against the top agent', () => {
    const rows = topAgents(root(testGraphNode('a', { tokens: 400 })), null)

    expect(rows.map((row) => row.bar)).toEqual([1, 0.25])
  })

  it('gives each share of the team total as a whole percent', () => {
    const rows = topAgents(root(testGraphNode('a', { tokens: 300 })), 400)

    expect(rows.map((row) => row.share)).toEqual([75, 25])
  })

  it('has no share without a team total, or with a total of zero', () => {
    const tree = root(testGraphNode('a', { tokens: 300 }))

    expect(topAgents(tree, null).map((row) => row.share)).toEqual([null, null])
    expect(topAgents(tree, 0).map((row) => row.share)).toEqual([null, null])
  })

  it('caps a share at 100 when an agent outgrows the total', () => {
    expect(topAgents(root(testGraphNode('a', { tokens: 300 })), 100)[0]?.share).toBe(100)
  })
})
