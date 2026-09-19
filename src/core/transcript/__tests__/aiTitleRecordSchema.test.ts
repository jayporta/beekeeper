import { describe, expect, it } from 'vitest'
import { aiTitleRecordSchema } from '../schemas/aiTitleRecord'
import { buildAiTitleRecord } from '../testFixtures'

describe('aiTitleRecordSchema', () => {
  it('accepts a well-formed ai-title record', () => {
    expect(aiTitleRecordSchema.safeParse(buildAiTitleRecord('Fix the flaky test')).success).toBe(
      true
    )
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const record = { ...buildAiTitleRecord(), futureField: 'unreleased' }

    expect(aiTitleRecordSchema.safeParse(record).success).toBe(true)
  })

  it('rejects a record missing the required title', () => {
    expect(aiTitleRecordSchema.safeParse({ type: 'ai-title' }).success).toBe(false)
  })

  it('rejects a record of a different type', () => {
    const record = { ...buildAiTitleRecord(), type: 'assistant' }

    expect(aiTitleRecordSchema.safeParse(record).success).toBe(false)
  })
})
