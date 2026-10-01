import { describe, expect, it } from 'vitest'
import { costStateRecordSchema, type CostStateRecord } from '../../schemas'
import { buildCostStateRecord } from '../../testFixtures'
import { recordedTokenTotal } from '../recordedTokenTotal'

function costState(overrides: Record<string, unknown>): CostStateRecord {
  return costStateRecordSchema.parse(buildCostStateRecord(overrides))
}

describe('recordedTokenTotal', () => {
  it('sums input, output, cache read and cache write across every model', () => {
    const state = costState({
      modelUsage: {
        a: {
          inputTokens: 1,
          outputTokens: 2,
          cacheReadInputTokens: 3,
          cacheCreationInputTokens: 4
        },
        b: {
          inputTokens: 10,
          outputTokens: 20,
          cacheReadInputTokens: 30,
          cacheCreationInputTokens: 40
        }
      }
    })
    expect(recordedTokenTotal(state)).toBe(110)
  })

  it('counts a missing field as zero', () => {
    expect(recordedTokenTotal(costState({ modelUsage: { a: { outputTokens: 5 } } }))).toBe(5)
  })

  it('does not add thinking tokens, which output already counts', () => {
    const state = costState({ modelUsage: { a: { outputTokens: 5, thinkingTokens: 3 } } })
    expect(recordedTokenTotal(state)).toBe(5)
  })

  it('reports an empty model usage as zero tokens', () => {
    expect(recordedTokenTotal(costState({ modelUsage: {} }))).toBe(0)
  })

  it('reports no total when the record has no model usage', () => {
    expect(recordedTokenTotal(costState({ modelUsage: undefined }))).toBeNull()
  })

  it('reports no total when the sum is not finite', () => {
    const huge = { inputTokens: 1e308, outputTokens: 1e308 }
    expect(recordedTokenTotal(costState({ modelUsage: { a: huge } }))).toBeNull()
  })
})
