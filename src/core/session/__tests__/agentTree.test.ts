import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import type { SubagentMeta } from '../../transcript/schemas'
import { buildSubagentMeta } from '../../transcript/testFixtures'
import { buildAgentTree, type AgentTreeInput, type AgentTreeNode } from '../agentTree'
import type { SubagentMetaStatus } from '../subagentMetaStatus'

function input(agentId: string, meta: Record<string, unknown> | null): AgentTreeInput {
  const metaStatus: SubagentMetaStatus =
    meta === null ? { status: 'absent' } : { status: 'ok', meta: meta as SubagentMeta }
  return { agentId: toAgentId(agentId), metaStatus }
}

/** Builds a linear chain of `length` subagents: `a0` has no parent, and each `ai`'s parent is `a(i-1)`. */
function buildLinearChain(length: number): AgentTreeInput[] {
  const chain: AgentTreeInput[] = []
  for (let i = 0; i < length; i += 1) {
    const meta = i === 0 ? buildSubagentMeta() : buildSubagentMeta({ parentAgentId: `a${i - 1}` })
    chain.push(input(`a${i}`, meta))
  }
  return chain
}

/** Counts how many single-child links deep a chain of tree nodes goes, iteratively. */
function chainDepth(root: AgentTreeNode): number {
  let depth = 0
  let current: AgentTreeNode | undefined = root
  while (current !== undefined && current.children.length > 0) {
    current = current.children[0]
    depth += 1
  }
  return depth
}

/** A branching tree fixture: its subagents, plus each node's expected children by id. */
interface BranchingTreeFixture {
  readonly subagents: AgentTreeInput[]
  readonly rootId: string
  readonly expectedChildIdsByNodeKey: ReadonlyMap<string, readonly string[]>
}

/**
 * Builds a tree `branchingFactor` children wide and `depth` levels deep
 * below a single root (whose own parent is the lead). Ids are zero-padded
 * so code-unit order matches assignment order, and each is assigned to its
 * parent before its own children, so `expectedChildIdsByNodeKey` already
 * reflects the order {@link buildAgentTree} is expected to produce.
 */
function buildBranchingTree(branchingFactor: number, depth: number): BranchingTreeFixture {
  const subagents: AgentTreeInput[] = []
  const expectedChildIdsByNodeKey = new Map<string, string[]>()
  let nextId = 0

  function makeId(): string {
    const id = `a${String(nextId).padStart(4, '0')}`
    nextId += 1
    return id
  }

  const rootId = makeId()
  subagents.push(input(rootId, buildSubagentMeta()))
  expectedChildIdsByNodeKey.set('lead', [rootId])

  let currentLevel = [rootId]
  for (let level = 0; level < depth; level += 1) {
    const nextLevel: string[] = []
    for (const parentId of currentLevel) {
      const children: string[] = []
      for (let i = 0; i < branchingFactor; i += 1) {
        const childId = makeId()
        subagents.push(input(childId, buildSubagentMeta({ parentAgentId: parentId })))
        children.push(childId)
        nextLevel.push(childId)
      }
      expectedChildIdsByNodeKey.set(parentId, children)
    }
    currentLevel = nextLevel
  }
  for (const leafId of currentLevel) expectedChildIdsByNodeKey.set(leafId, [])

  return { subagents, rootId, expectedChildIdsByNodeKey }
}

/** The key a tree node is expected under in `expectedChildIdsByNodeKey`. */
function nodeKey(node: AgentTreeNode): string {
  return node.identity.kind === 'lead' ? 'lead' : node.identity.agentId
}

describe('buildAgentTree', () => {
  it('builds a lead-only tree when there are no subagents', () => {
    const tree = buildAgentTree([])

    expect(tree.identity).toEqual({ kind: 'lead' })
    expect(tree.metaStatus).toEqual({ status: 'absent' })
    expect(tree.isTeammate).toBe(false)
    expect(tree.children).toEqual([])
  })

  it('parents a subagent with no meta under the lead', () => {
    const tree = buildAgentTree([input('a', null)])

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.identity).toEqual({ kind: 'subagent', agentId: 'a' })
    expect(tree.children[0]?.metaStatus).toEqual({ status: 'absent' })
  })

  it('parents a subagent with an unreadable meta under the lead, carrying the error status', () => {
    const errorInput: AgentTreeInput = {
      agentId: toAgentId('a'),
      metaStatus: { status: 'error', reason: 'invalid-shape' }
    }

    const tree = buildAgentTree([errorInput])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
    expect(tree.children[0]?.metaStatus).toEqual({ status: 'error', reason: 'invalid-shape' })
    expect(tree.children[0]?.isTeammate).toBe(false)
  })

  it('parents a subagent under the lead when parentAgentId is absent', () => {
    const tree = buildAgentTree([input('a', buildSubagentMeta())])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
  })

  it('nests a subagent under its named parent', () => {
    const tree = buildAgentTree([
      input('parent', buildSubagentMeta()),
      input('child', buildSubagentMeta({ parentAgentId: 'parent' }))
    ])

    const parentNode = tree.children.find(
      (c) => c.identity.kind === 'subagent' && c.identity.agentId === 'parent'
    )
    expect(parentNode?.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'child' }
    ])
  })

  it('nests three levels deep', () => {
    const tree = buildAgentTree([
      input('grandparent', buildSubagentMeta()),
      input('parent', buildSubagentMeta({ parentAgentId: 'grandparent' })),
      input('child', buildSubagentMeta({ parentAgentId: 'parent' }))
    ])

    const grandparent = tree.children[0]
    const parent = grandparent?.children[0]
    const child = parent?.children[0]

    expect(grandparent?.identity).toEqual({ kind: 'subagent', agentId: 'grandparent' })
    expect(parent?.identity).toEqual({ kind: 'subagent', agentId: 'parent' })
    expect(child?.identity).toEqual({ kind: 'subagent', agentId: 'child' })
  })

  it('falls back to the lead when parentAgentId names no known subagent', () => {
    const tree = buildAgentTree([input('a', buildSubagentMeta({ parentAgentId: 'nobody' }))])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
  })

  it('falls back to the lead when a subagent names itself as its own parent', () => {
    const tree = buildAgentTree([input('a', buildSubagentMeta({ parentAgentId: 'a' }))])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
    expect(tree.children[0]?.children).toEqual([])
  })

  it('falls back to the lead for both agents in a mutual parent cycle', () => {
    const tree = buildAgentTree([
      input('a', buildSubagentMeta({ parentAgentId: 'b' })),
      input('b', buildSubagentMeta({ parentAgentId: 'a' }))
    ])

    expect(tree.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'a' },
      { kind: 'subagent', agentId: 'b' }
    ])
    expect(tree.children.every((c) => c.children.length === 0)).toBe(true)
  })

  it("keeps a subagent under its parent when that parent's own chain runs into a cycle it isn't part of", () => {
    // c -> a -> b -> a: a and b cycle between themselves and both fall
    // back to the lead, but c's own link to a is still well-formed, so c
    // stays nested under a rather than also falling back.
    const tree = buildAgentTree([
      input('c', buildSubagentMeta({ parentAgentId: 'a' })),
      input('a', buildSubagentMeta({ parentAgentId: 'b' })),
      input('b', buildSubagentMeta({ parentAgentId: 'a' }))
    ])

    expect(tree.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'a' },
      { kind: 'subagent', agentId: 'b' }
    ])

    const nodeA = tree.children.find(
      (c) => c.identity.kind === 'subagent' && c.identity.agentId === 'a'
    )
    const nodeB = tree.children.find(
      (c) => c.identity.kind === 'subagent' && c.identity.agentId === 'b'
    )
    expect(nodeA?.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'c' }])
    expect(nodeB?.children).toEqual([])
  })

  it('marks a subagent with a teamName as a teammate', () => {
    const tree = buildAgentTree([input('a', buildSubagentMeta({ teamName: 'core-team' }))])

    expect(tree.children[0]?.isTeammate).toBe(true)
  })

  it('does not mark a subagent with no teamName as a teammate, even without toolUseId', () => {
    const tree = buildAgentTree([input('a', buildSubagentMeta())])

    expect(tree.children[0]?.isTeammate).toBe(false)
  })

  it('orders children by agent id', () => {
    const tree = buildAgentTree([
      input('zed', buildSubagentMeta()),
      input('alpha', buildSubagentMeta())
    ])

    expect(tree.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'alpha' },
      { kind: 'subagent', agentId: 'zed' }
    ])
  })

  it('builds a 20,000-deep linear chain without throwing, with the correct depth', () => {
    const chainLength = 20_000

    const tree = buildAgentTree(buildLinearChain(chainLength))

    expect(chainDepth(tree)).toBe(chainLength)
  })

  it('builds a large branching tree completely, with each node holding its expected children', () => {
    const branchingFactor = 5
    const depth = 5
    const { subagents, expectedChildIdsByNodeKey } = buildBranchingTree(branchingFactor, depth)

    const tree = buildAgentTree(subagents)

    let visitedCount = 0
    const stack: AgentTreeNode[] = [tree]
    while (stack.length > 0) {
      const node = stack.pop()
      if (node === undefined) continue
      visitedCount += 1

      const actualChildIds = node.children.map((c) =>
        c.identity.kind === 'subagent' ? c.identity.agentId : ''
      )
      expect(actualChildIds).toEqual(expectedChildIdsByNodeKey.get(nodeKey(node)) ?? [])

      stack.push(...node.children)
    }

    expect(visitedCount).toBe(subagents.length + 1) // the lead, plus every subagent
  })

  it('keeps only the first occurrence of a duplicate agent id, without multiplying its subtree', () => {
    const tree = buildAgentTree([
      input('a', buildSubagentMeta({ agentType: 'first' })),
      input('a', buildSubagentMeta({ agentType: 'second' })),
      input('child', buildSubagentMeta({ parentAgentId: 'a' }))
    ])

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.identity).toEqual({ kind: 'subagent', agentId: 'a' })
    expect(tree.children[0]?.metaStatus).toEqual({
      status: 'ok',
      meta: { agentType: 'first' }
    })
    expect(tree.children[0]?.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'child' }
    ])
  })
})
