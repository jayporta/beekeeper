import { describe, expect, it } from 'vitest'
import { costStateRecordSchema } from '../schemas/costStateRecord'
import { buildCostStateRecord } from '../testFixtures'

describe('costStateRecordSchema', () => {
  it('accepts a well-formed cost-state record', () => {
    expect(costStateRecordSchema.safeParse(buildCostStateRecord()).success).toBe(true)
  })

  it('keeps a raw, bracketed model id in modelUsage rather than a fixed key', () => {
    const result = costStateRecordSchema.safeParse(buildCostStateRecord())

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.modelUsage?.['claude-opus-5[1m]']).toBeDefined()
    }
  })

  it('accepts a record with no modelUsage at all', () => {
    const record = buildCostStateRecord({ modelUsage: undefined })

    expect(costStateRecordSchema.safeParse(record).success).toBe(true)
  })

  it('accepts unknown extra fields (schema drift)', () => {
    const record = { ...buildCostStateRecord(), futureField: 'unreleased' }

    expect(costStateRecordSchema.safeParse(record).success).toBe(true)
  })

  it('rejects a modelUsage entry whose costUSD is not a number', () => {
    const record = buildCostStateRecord({
      modelUsage: { 'claude-opus-5': { outputTokens: 5, costUSD: 'not-a-number' } }
    })

    expect(costStateRecordSchema.safeParse(record).success).toBe(false)
  })

  it.each([
    'inputTokens',
    'outputTokens',
    'cacheReadInputTokens',
    'cacheCreationInputTokens',
    'costUSD'
  ])('rejects a modelUsage entry with a negative %s', (field) => {
    const record = buildCostStateRecord({ modelUsage: { 'claude-opus-5': { [field]: -1 } } })

    expect(costStateRecordSchema.safeParse(record).success).toBe(false)
  })

  it('rejects a negative totalCostUSD', () => {
    expect(
      costStateRecordSchema.safeParse(buildCostStateRecord({ totalCostUSD: -1 })).success
    ).toBe(false)
  })

  it('accepts a negative thinkingTokens or webSearchRequests, since neither is read', () => {
    const record = buildCostStateRecord({
      modelUsage: { 'claude-opus-5': { thinkingTokens: -1, webSearchRequests: -1 } }
    })

    expect(costStateRecordSchema.safeParse(record).success).toBe(true)
  })

  it('round-trips a numeric totalCostUSD but rejects a non-number one', () => {
    const validRecord = buildCostStateRecord({ totalCostUSD: 4.56 })
    const validResult = costStateRecordSchema.safeParse(validRecord)

    expect(validResult.success).toBe(true)
    if (validResult.success) {
      expect(validResult.data.totalCostUSD).toBe(4.56)
    }

    const invalidRecord = buildCostStateRecord({ totalCostUSD: '4.56' })
    expect(costStateRecordSchema.safeParse(invalidRecord).success).toBe(false)
  })

  it('rejects a record of a different type', () => {
    const record = { ...buildCostStateRecord(), type: 'assistant' }

    expect(costStateRecordSchema.safeParse(record).success).toBe(false)
  })
})
