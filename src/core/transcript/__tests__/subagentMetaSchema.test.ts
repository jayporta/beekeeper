import { describe, expect, it } from 'vitest'
import { subagentMetaSchema } from '../schemas/subagentMeta'
import { buildMinimalSubagentMeta } from '../testFixtures'

describe('subagentMetaSchema', () => {
  it('accepts a meta object with only the required agentType', () => {
    expect(subagentMetaSchema.safeParse(buildMinimalSubagentMeta('general-purpose')).success).toBe(
      true
    )
  })

  it('accepts a fully populated meta object', () => {
    const record = {
      agentType: 'code-reviewer',
      description: 'Reviews the diff',
      model: 'claude-opus-5',
      toolUseId: 'tool-1',
      parentAgentId: 'agent-parent',
      spawnDepth: 2,
      stoppedByUser: false,
      worktreePath: '/tmp/worktree',
      worktreeBranch: 'feat/example',
      teamName: 'core-team',
      name: 'reviewer-1',
      taskKind: 'review',
      isFork: true
    }

    expect(subagentMetaSchema.safeParse(record).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const record = { ...buildMinimalSubagentMeta(), futureField: 'unreleased' }

    expect(subagentMetaSchema.safeParse(record).success).toBe(true)
  })

  it('rejects a meta object missing the required agentType', () => {
    expect(subagentMetaSchema.safeParse({ description: 'No type given' }).success).toBe(false)
  })
})
