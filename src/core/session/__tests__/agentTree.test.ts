import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { buildSubagentMeta } from '../../transcript/testFixtures'
import { resolveAgentHierarchy } from '../agentHierarchy'
import { buildAgentTree, type AgentTreeInput, type AgentTreeNode } from '../agentTree'
import { buildTreeInput } from '../testAgentTreeFixtures'

/** Builds the tree from raw subagent inputs, resolving the hierarchy first. */
function buildTestTree(subagents: readonly AgentTreeInput[]): AgentTreeNode {
  return buildAgentTree(resolveAgentHierarchy(subagents))
}

/** Builds a linear chain of `length` subagents: `a0` has no parent, and each `ai`'s parent is `a(i-1)`. */
function buildLinearChain(length: number): AgentTreeInput[] {
  const chain: AgentTreeInput[] = []
  for (let i = 0; i < length; i += 1) {
    const meta = i === 0 ? buildSubagentMeta() : buildSubagentMeta({ parentAgentId: `a${i - 1}` })
    chain.push(buildTreeInput(`a${i}`, meta))
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
  subagents.push(buildTreeInput(rootId, buildSubagentMeta()))
  expectedChildIdsByNodeKey.set('lead', [rootId])

  let currentLevel = [rootId]
  for (let level = 0; level < depth; level += 1) {
    const nextLevel: string[] = []
    for (const parentId of currentLevel) {
      const children: string[] = []
      for (let i = 0; i < branchingFactor; i += 1) {
        const childId = makeId()
        subagents.push(buildTreeInput(childId, buildSubagentMeta({ parentAgentId: parentId })))
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
    const tree = buildTestTree([])

    expect(tree.identity).toEqual({ kind: 'lead' })
    expect(tree.metaStatus).toEqual({ status: 'absent' })
    expect(tree.children).toEqual([])
  })

  it('parents a subagent with no meta under the lead', () => {
    const tree = buildTestTree([buildTreeInput('a', null)])

    expect(tree.children).toHaveLength(1)
    expect(tree.children[0]?.identity).toEqual({ kind: 'subagent', agentId: 'a' })
    expect(tree.children[0]?.metaStatus).toEqual({ status: 'absent' })
  })

  it('parents a subagent with an unreadable meta under the lead, carrying the error status', () => {
    const errorInput: AgentTreeInput = {
      agentId: toAgentId('a'),
      metaStatus: { status: 'error', reason: 'invalid-shape' }
    }

    const tree = buildTestTree([errorInput])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
    expect(tree.children[0]?.metaStatus).toEqual({ status: 'error', reason: 'invalid-shape' })
  })

  it('parents a subagent under the lead when parentAgentId is absent', () => {
    const tree = buildTestTree([buildTreeInput('a', buildSubagentMeta())])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
  })

  it('nests a subagent under its named parent', () => {
    const tree = buildTestTree([
      buildTreeInput('parent', buildSubagentMeta()),
      buildTreeInput('child', buildSubagentMeta({ parentAgentId: 'parent' }))
    ])

    const parentNode = tree.children.find(
      (c) => c.identity.kind === 'subagent' && c.identity.agentId === 'parent'
    )
    expect(parentNode?.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'child' }
    ])
  })

  it('nests three levels deep', () => {
    const tree = buildTestTree([
      buildTreeInput('grandparent', buildSubagentMeta()),
      buildTreeInput('parent', buildSubagentMeta({ parentAgentId: 'grandparent' })),
      buildTreeInput('child', buildSubagentMeta({ parentAgentId: 'parent' }))
    ])

    const grandparent = tree.children[0]
    const parent = grandparent?.children[0]
    const child = parent?.children[0]

    expect(grandparent?.identity).toEqual({ kind: 'subagent', agentId: 'grandparent' })
    expect(parent?.identity).toEqual({ kind: 'subagent', agentId: 'parent' })
    expect(child?.identity).toEqual({ kind: 'subagent', agentId: 'child' })
  })

  it('falls back to the lead when parentAgentId names no known subagent', () => {
    const tree = buildTestTree([
      buildTreeInput('a', buildSubagentMeta({ parentAgentId: 'nobody' }))
    ])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
  })

  it('falls back to the lead when a subagent names itself as its own parent', () => {
    const tree = buildTestTree([buildTreeInput('a', buildSubagentMeta({ parentAgentId: 'a' }))])

    expect(tree.children.map((c) => c.identity)).toEqual([{ kind: 'subagent', agentId: 'a' }])
    expect(tree.children[0]?.children).toEqual([])
  })

  it('falls back to the lead for both agents in a mutual parent cycle', () => {
    const tree = buildTestTree([
      buildTreeInput('a', buildSubagentMeta({ parentAgentId: 'b' })),
      buildTreeInput('b', buildSubagentMeta({ parentAgentId: 'a' }))
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
    const tree = buildTestTree([
      buildTreeInput('c', buildSubagentMeta({ parentAgentId: 'a' })),
      buildTreeInput('a', buildSubagentMeta({ parentAgentId: 'b' })),
      buildTreeInput('b', buildSubagentMeta({ parentAgentId: 'a' }))
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

  it('orders children by agent id', () => {
    const tree = buildTestTree([
      buildTreeInput('zed', buildSubagentMeta()),
      buildTreeInput('alpha', buildSubagentMeta())
    ])

    expect(tree.children.map((c) => c.identity)).toEqual([
      { kind: 'subagent', agentId: 'alpha' },
      { kind: 'subagent', agentId: 'zed' }
    ])
  })

  it('builds a 20,000-deep linear chain without throwing, with the correct depth', () => {
    const chainLength = 20_000

    const tree = buildTestTree(buildLinearChain(chainLength))

    expect(chainDepth(tree)).toBe(chainLength)
  })

  it('builds a large branching tree completely, with each node holding its expected children', () => {
    const branchingFactor = 5
    const depth = 5
    const { subagents, expectedChildIdsByNodeKey } = buildBranchingTree(branchingFactor, depth)

    const tree = buildTestTree(subagents)

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
    const tree = buildTestTree([
      buildTreeInput('a', buildSubagentMeta({ agentType: 'first' })),
      buildTreeInput('a', buildSubagentMeta({ agentType: 'second' })),
      buildTreeInput('child', buildSubagentMeta({ parentAgentId: 'a' }))
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
