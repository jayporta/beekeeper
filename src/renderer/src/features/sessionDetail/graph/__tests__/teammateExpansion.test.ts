import { describe, expect, it } from 'vitest'
import { testRef } from '@renderer/features/sessions/testSessionFixtures'
import { testDetail, testMeta, testNode } from '../../testSessionDetail'
import type { AgentGraphNode, RootAgentGraphNode } from '../agentGraphNode'
import { expansionOf, graftTeammates, type TeammateExpansion } from '../teammateExpansion'
import { testGraphNode } from '../testGraphNode'

const MATE = testRef(2, '-other')

describe('expansionOf', () => {
  it('is loading while the detail has not arrived', () => {
    expect(expansionOf({ data: undefined, isError: false }, MATE)).toEqual({ status: 'loading' })
  })

  it('is an error when the detail failed and none was ever loaded', () => {
    expect(expansionOf({ data: undefined, isError: true }, MATE)).toEqual({ status: 'error' })
  })

  it('holds the teammate’s subagents, owned by the teammate’s session', () => {
    const detail = testDetail({
      children: [
        testNode('w1', { meta: testMeta({ name: 'drafter' }), children: [testNode('w2')] })
      ]
    })

    const expansion = expansionOf({ data: detail, isError: false }, MATE)

    expect(expansion).toMatchObject({ status: 'ready', partial: false })
    const [child] = expansion.status === 'ready' ? expansion.children : []
    expect(child).toMatchObject({
      key: 'sub:-other/00000002-0000-4000-8000-000000000000:w1',
      name: 'drafter',
      selection: { kind: 'subagent', ownerRef: MATE, agentId: 'w1' }
    })
    expect(child?.children).toHaveLength(1)
  })

  it('hands back the same expansion, and so the same nodes, for the same detail and teammate', () => {
    const detail = testDetail({ children: [testNode('w1')] })

    const first = expansionOf({ data: detail, isError: false }, MATE)
    const again = expansionOf({ data: detail, isError: true }, testRef(2, '-other'))

    expect(again).toBe(first)
  })

  it('builds anew for another detail, or for another teammate’s session', () => {
    const detail = testDetail({ children: [testNode('w1')] })
    const first = expansionOf({ data: detail, isError: false }, MATE)

    expect(
      expansionOf({ data: testDetail({ children: [testNode('w1')] }), isError: false }, MATE)
    ).not.toBe(first)
    expect(expansionOf({ data: detail, isError: false }, testRef(3, '-other'))).not.toBe(first)
  })

  it('keeps a loaded detail when a later refresh failed', () => {
    const expansion = expansionOf({ data: testDetail(), isError: true }, MATE)

    expect(expansion.status).toBe('ready')
  })

  it('is ready, partial and empty when the teammate’s subagents could not be read', () => {
    const detail = testDetail({ children: [testNode('w1')], reports: false })

    expect(expansionOf({ data: detail, isError: false }, MATE)).toEqual({
      status: 'ready',
      children: [],
      partial: true
    })
  })
})

describe('graftTeammates', () => {
  const grafted = testGraphNode('sub:x:w1')
  const mateA = testGraphNode('mate:a', { kind: 'teammate', partial: false })
  const mateB = testGraphNode('mate:b', { kind: 'teammate', partial: false })
  const subagent = testGraphNode('sub:y:a1')
  const root: RootAgentGraphNode = {
    ...testGraphNode('lead', { children: [subagent, mateA, mateB], kind: 'lead' }),
    key: 'lead',
    missingTeammates: 2,
    teamListsTruncated: true
  }

  const graft = (entries: [string, TeammateExpansion][]): RootAgentGraphNode =>
    graftTeammates(root, new Map(entries as [AgentGraphNode['key'], TeammateExpansion][]))

  it('returns the same root when nothing is expanded', () => {
    expect(graftTeammates(root, new Map())).toBe(root)
  })

  it('puts a ready teammate’s subagents under it', () => {
    const result = graft([['mate:a', { status: 'ready', children: [grafted], partial: false }]])

    expect(result.children[1]?.children).toEqual([grafted])
    expect(result.children[2]?.children).toEqual([])
  })

  it('clears the mark that a teammate’s subagents are not loaded once they are', () => {
    const unloaded: RootAgentGraphNode = {
      ...root,
      children: [testGraphNode('mate:a', { kind: 'teammate', subagentsNotLoaded: true })]
    }

    const result = graftTeammates(
      unloaded,
      new Map([['mate:a', { status: 'ready', children: [], partial: false } as const]])
    )

    expect(result.children[0]?.subagentsNotLoaded).toBe(false)
  })

  it('keeps the mark that subagents are not loaded when the teammate’s load failed', () => {
    const unloaded: RootAgentGraphNode = {
      ...root,
      children: [testGraphNode('mate:a', { kind: 'teammate', subagentsNotLoaded: true })]
    }

    const result = graftTeammates(unloaded, new Map([['mate:a', { status: 'error' } as const]]))

    expect(result.children[0]?.subagentsNotLoaded).toBe(true)
  })

  it('marks a teammate partial when its subagents were only partly read', () => {
    const result = graft([['mate:a', { status: 'ready', children: [], partial: true }]])

    expect(result.children[1]?.partial).toBe(true)
  })

  it('keeps a teammate partial that was already partial', () => {
    const partialRoot: RootAgentGraphNode = {
      ...root,
      children: [testGraphNode('mate:a', { kind: 'teammate', partial: true })]
    }

    const result = graftTeammates(
      partialRoot,
      new Map([['mate:a', { status: 'ready', children: [], partial: false } as const]])
    )

    expect(result.children[0]?.partial).toBe(true)
  })

  it('marks a teammate partial when its load failed, and adds nothing under it', () => {
    const result = graft([['mate:a', { status: 'error' }]])

    expect(result.children[1]).toMatchObject({ partial: true, children: [] })
  })

  it('leaves a teammate that is still loading as it was', () => {
    const result = graft([['mate:a', { status: 'loading' }]])

    expect(result.children[1]).toBe(mateA)
  })

  it('returns the same root while every expanded teammate is still loading', () => {
    expect(
      graft([
        ['mate:a', { status: 'loading' }],
        ['mate:b', { status: 'loading' }]
      ])
    ).toBe(root)
  })

  it('returns the same root for a failed load of a teammate that was already partial', () => {
    const partialRoot: RootAgentGraphNode = {
      ...root,
      children: [testGraphNode('mate:a', { kind: 'teammate', partial: true })]
    }

    const result = graftTeammates(partialRoot, new Map([['mate:a', { status: 'error' } as const]]))

    expect(result).toBe(partialRoot)
  })

  it('returns a new root once any expanded teammate has something to change', () => {
    const result = graft([
      ['mate:a', { status: 'loading' }],
      ['mate:b', { status: 'error' }]
    ])

    expect(result).not.toBe(root)
    expect(result.children[2]?.partial).toBe(true)
  })

  it('leaves every other node, and the root’s own fields, untouched', () => {
    const result = graft([['mate:a', { status: 'ready', children: [grafted], partial: false }]])

    expect(result.children[0]).toBe(subagent)
    expect(result.children[2]).toBe(mateB)
    expect(result).toMatchObject({ key: 'lead', missingTeammates: 2, teamListsTruncated: true })
  })

  it('ignores an expansion for a node the graph does not hold', () => {
    const result = graft([['mate:gone', { status: 'error' }]])

    expect(result.children).toEqual(root.children)
  })
})
