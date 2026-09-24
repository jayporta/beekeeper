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

  it.each([
    ['a relative worktreePath', { worktreePath: 'relative/tree' }],
    ['an oversized worktreePath', { worktreePath: '/' + 'a'.repeat(4096) }],
    ['a non-string worktreePath', { worktreePath: 7 }],
    ['an empty worktreeBranch', { worktreeBranch: '' }],
    ['an oversized worktreeBranch', { worktreeBranch: 'b'.repeat(256) }],
    ['a non-boolean spawnedWithWorktree', { spawnedWithWorktree: 'yes' }],
    ['a non-boolean worktreeCleanlyRemoved', { worktreeCleanlyRemoved: 1 }]
  ])('keeps the meta and reads %s as absent', (_label, bad) => {
    const parsed = subagentMetaSchema.safeParse({ ...buildMinimalSubagentMeta('reviewer'), ...bad })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.agentType).toBe('reviewer')
    for (const key of Object.keys(bad)) {
      expect(parsed.data[key as keyof typeof parsed.data]).toBeUndefined()
    }
  })

  it('reads valid worktree fields and the worktree flags', () => {
    const parsed = subagentMetaSchema.parse({
      agentType: 'x',
      worktreePath: '/tmp/tree',
      worktreeBranch: 'feat/a',
      spawnedWithWorktree: true,
      worktreeCleanlyRemoved: false
    })

    expect(parsed).toMatchObject({
      worktreePath: '/tmp/tree',
      worktreeBranch: 'feat/a',
      spawnedWithWorktree: true,
      worktreeCleanlyRemoved: false
    })
  })
})
