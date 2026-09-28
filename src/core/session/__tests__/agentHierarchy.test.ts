import { describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { buildSubagentMeta } from '../../transcript/testFixtures'
import { resolveAgentHierarchy } from '../agentHierarchy'
import { buildTreeInput } from '../testAgentTreeFixtures'

describe('resolveAgentHierarchy', () => {
  it('keeps only the first occurrence of a repeated agent id', () => {
    const hierarchy = resolveAgentHierarchy([
      buildTreeInput('a', buildSubagentMeta({ agentType: 'first' })),
      buildTreeInput('a', buildSubagentMeta({ agentType: 'second' }))
    ])

    expect(hierarchy.subagents).toHaveLength(1)
    expect(hierarchy.subagents[0]?.metaStatus).toEqual({
      status: 'ok',
      meta: { agentType: 'first' }
    })
  })

  it("resolves a subagent's parent from its meta", () => {
    const hierarchy = resolveAgentHierarchy([
      buildTreeInput('parent', buildSubagentMeta()),
      buildTreeInput('child', buildSubagentMeta({ parentAgentId: 'parent' }))
    ])

    expect(hierarchy.parentOf.get(toAgentId('child'))).toBe(toAgentId('parent'))
  })

  it('leaves a subagent on a cycle with no parent', () => {
    const hierarchy = resolveAgentHierarchy([
      buildTreeInput('a', buildSubagentMeta({ parentAgentId: 'b' })),
      buildTreeInput('b', buildSubagentMeta({ parentAgentId: 'a' }))
    ])

    expect(hierarchy.parentOf.has(toAgentId('a'))).toBe(false)
    expect(hierarchy.parentOf.has(toAgentId('b'))).toBe(false)
  })

  it('leaves a subagent whose parentAgentId names no subagent here with no parent', () => {
    const hierarchy = resolveAgentHierarchy([
      buildTreeInput('a', buildSubagentMeta({ parentAgentId: 'gone' }))
    ])

    expect(hierarchy.parentOf.has(toAgentId('a'))).toBe(false)
  })
})
