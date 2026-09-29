import { describe, expect, it } from 'vitest'
import { MAX_BRANCH_CODE_UNITS } from '../../shared/boundedBranch'
import { MAX_PATH_CODE_UNITS } from '../../shared/boundedPath'
import { MAX_LABEL_CODE_UNITS } from '../boundedLabel'
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
    ['an oversized worktreePath', { worktreePath: '/' + 'a'.repeat(MAX_PATH_CODE_UNITS) }],
    ['a non-string worktreePath', { worktreePath: 7 }],
    // 3000 non-BMP characters: 3000 code points, but 6000 UTF-16 code units.
    [
      'a non-BMP worktreePath under the code-point cap but over the code-unit cap',
      { worktreePath: '/' + '😀'.repeat(3000) }
    ],
    ['an empty worktreeBranch', { worktreeBranch: '' }],
    ['an oversized worktreeBranch', { worktreeBranch: 'b'.repeat(MAX_BRANCH_CODE_UNITS + 1) }],
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    [
      'a non-BMP worktreeBranch under the code-point cap but over the code-unit cap',
      { worktreeBranch: '😀'.repeat(200) }
    ]
  ])('keeps the meta and reads %s as absent', (_label, bad) => {
    const parsed = subagentMetaSchema.safeParse({ ...buildMinimalSubagentMeta('reviewer'), ...bad })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.agentType).toBe('reviewer')
    for (const key of Object.keys(bad)) {
      expect(parsed.data[key as keyof typeof parsed.data]).toBeUndefined()
    }
  })

  describe.each(['teamName', 'name'] as const)('%s label', (field) => {
    it.each([
      ['an oversized value', 'x'.repeat(MAX_LABEL_CODE_UNITS + 1)],
      // Each U+0344 is one code unit that NFC expands to two: 200 fit the cap, 400 do not.
      ['a value NFC expands past the cap', '̈́'.repeat(200)],
      ['a value with a newline', 'sc\nout'],
      ['a value with a bidi override', 'sc‮out'],
      ['a blank value', '   ']
    ])('keeps the meta and reads %s as absent', (_label, bad) => {
      const parsed = subagentMetaSchema.safeParse({
        ...buildMinimalSubagentMeta('reviewer'),
        [field]: bad
      })

      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      expect(parsed.data.agentType).toBe('reviewer')
      expect(parsed.data[field]).toBeUndefined()
    })

    it('keeps the meta and reads a non-string value as absent', () => {
      const parsed = subagentMetaSchema.safeParse({
        ...buildMinimalSubagentMeta('reviewer'),
        [field]: 7
      })

      expect(parsed.success).toBe(true)
      if (!parsed.success) return
      expect(parsed.data.agentType).toBe('reviewer')
      expect(parsed.data[field]).toBeUndefined()
    })

    it('trims the value and normalizes it to NFC', () => {
      const parsed = subagentMetaSchema.parse({
        ...buildMinimalSubagentMeta('reviewer'),
        [field]: '  café '
      })

      expect(parsed[field]).toBe('café')
    })

    it('keeps a real-looking value unchanged', () => {
      const parsed = subagentMetaSchema.parse({
        ...buildMinimalSubagentMeta('reviewer'),
        [field]: 'core-team_2'
      })

      expect(parsed[field]).toBe('core-team_2')
    })
  })

  it.each([
    ['an oversized agentType', 'x'.repeat(MAX_LABEL_CODE_UNITS + 1)],
    ['an agentType NFC expands past the cap', '̈́'.repeat(200)],
    ['an agentType with a newline', 'code\nreviewer'],
    ['a blank agentType', '  ']
  ])('rejects the whole meta for %s', (_label, agentType) => {
    expect(subagentMetaSchema.safeParse({ agentType }).success).toBe(false)
  })

  it('trims an agentType and normalizes it to NFC', () => {
    expect(subagentMetaSchema.parse({ agentType: ' café ' }).agentType).toBe('café')
  })

  it('keeps a real-looking agentType unchanged', () => {
    expect(subagentMetaSchema.parse({ agentType: 'code-reviewer' }).agentType).toBe('code-reviewer')
  })

  it('reads valid worktree fields', () => {
    const parsed = subagentMetaSchema.parse({
      agentType: 'x',
      worktreePath: '/tmp/tree',
      worktreeBranch: 'feat/a'
    })

    expect(parsed).toMatchObject({ worktreePath: '/tmp/tree', worktreeBranch: 'feat/a' })
  })

  it('accepts an unknown key but strips it from the parsed data', () => {
    const parsed = subagentMetaSchema.safeParse({ agentType: 'x', futureField: 'kept?' })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).not.toHaveProperty('futureField')
  })
})
