import { describe, expect, it } from 'vitest'
import { buildCostStateRecord } from '../../testFixtures'
import { createRecordedCostState, RECORDED_MODEL_OVERHEAD } from '../recordedCostState'

function observed(
  ...records: Record<string, unknown>[]
): ReturnType<typeof createRecordedCostState> {
  const state = createRecordedCostState()
  for (const record of records) state.observe(record)
  return state
}

/** A model entry with every field the reconciliation reads. */
const FULL_ENTRY = {
  inputTokens: 1,
  outputTokens: 2,
  cacheReadInputTokens: 3,
  cacheCreationInputTokens: 4,
  costUSD: 0.5
}

describe('createRecordedCostState', () => {
  it('has no cost state before one is observed', () => {
    expect(observed({ type: 'user' }).latest()).toBeNull()
  })

  it('keeps the last valid cost-state record', () => {
    const state = observed(
      buildCostStateRecord({ totalCostUSD: 1 }),
      buildCostStateRecord({ totalCostUSD: 2 })
    )

    expect(state.latest()?.totalCostUSD).toBe(2)
  })

  it('does not let an invalid cost-state record displace a valid one', () => {
    const state = observed(
      buildCostStateRecord({ totalCostUSD: 1 }),
      buildCostStateRecord({ totalCostUSD: 'a lot' })
    )

    expect(state.latest()?.totalCostUSD).toBe(1)
  })

  it('keeps the total and the fields of each model the reconciliation reads', () => {
    const state = observed(
      buildCostStateRecord({ totalCostUSD: 3, modelUsage: { 'claude-opus-5': FULL_ENTRY } })
    )

    expect(state.latest()).toEqual({
      type: 'cost-state',
      totalCostUSD: 3,
      modelUsage: { 'claude-opus-5': FULL_ENTRY }
    })
  })

  it('drops a model whose key is not a bounded identifier', () => {
    const state = observed(
      buildCostStateRecord({
        modelUsage: { 'good-model': FULL_ENTRY, ['bad\u0000model']: FULL_ENTRY }
      })
    )

    expect(Object.keys(state.latest()?.modelUsage ?? {})).toEqual(['good-model'])
  })

  it('drops fields the reconciliation does not read', () => {
    const state = observed(
      buildCostStateRecord({
        unknownTopLevel: 'x'.repeat(1000),
        modelUsage: { m: { ...FULL_ENTRY, unknownField: 'y'.repeat(1000) } }
      })
    )

    expect(JSON.stringify(state.latest())).not.toContain('xxxx')
    expect(JSON.stringify(state.latest())).not.toContain('yyyy')
  })

  it('keeps a record with no model usage as one with none', () => {
    const state = observed({ type: 'cost-state', totalCostUSD: 4 })

    expect(state.latest()).toEqual({ type: 'cost-state', totalCostUSD: 4 })
  })

  describe('totalTokens', () => {
    it('is null before a cost state is observed', () => {
      expect(observed({ type: 'user' }).totalTokens()).toBeNull()
    })

    it('adds the four token classes of every model', () => {
      const state = observed(
        buildCostStateRecord({
          modelUsage: { 'model-a': FULL_ENTRY, 'model-b': { inputTokens: 10, costUSD: 1 } }
        })
      )

      expect(state.totalTokens()).toBe(1 + 2 + 3 + 4 + 10)
    })

    it('counts a model whose key is not a bounded identifier, which the kept record drops', () => {
      const state = observed(
        buildCostStateRecord({
          modelUsage: { 'good-model': { inputTokens: 3 }, ['bad\u0007model']: { outputTokens: 4 } }
        })
      )

      expect(Object.keys(state.latest()?.modelUsage ?? {})).toEqual(['good-model'])
      expect(state.totalTokens()).toBe(7)
    })

    it('is null for a record with no model usage', () => {
      expect(observed({ type: 'cost-state', totalCostUSD: 4 }).totalTokens()).toBeNull()
    })

    it('follows the last valid record', () => {
      const state = observed(
        buildCostStateRecord({ modelUsage: { m: { inputTokens: 5 } } }),
        buildCostStateRecord({ modelUsage: { m: { inputTokens: 9 } } }),
        buildCostStateRecord({ modelUsage: 'not a record' })
      )

      expect(state.totalTokens()).toBe(9)
    })
  })

  describe('weight', () => {
    it('is zero before a cost state is observed', () => {
      expect(observed().weight()).toBe(0)
    })

    it('charges a model its overhead and the length of its key', () => {
      const none = observed(buildCostStateRecord({ modelUsage: {} }))
      const two = observed(
        buildCostStateRecord({ modelUsage: { 'model-a': FULL_ENTRY, 'model-bb': FULL_ENTRY } })
      )

      expect(two.weight() - none.weight()).toBe(
        2 * RECORDED_MODEL_OVERHEAD + 'model-a'.length + 'model-bb'.length
      )
    })

    it('does not grow with a field the reconciliation does not read', () => {
      const plain = observed(buildCostStateRecord())
      const padded = observed(buildCostStateRecord({ unknownTopLevel: 'x'.repeat(100_000) }))

      expect(padded.weight()).toBe(plain.weight())
    })

    it('follows the latest record, not the largest', () => {
      const state = observed(
        buildCostStateRecord({ modelUsage: { 'model-a': FULL_ENTRY, 'model-b': FULL_ENTRY } }),
        buildCostStateRecord({ modelUsage: {} })
      )

      expect(state.weight()).toBe(observed(buildCostStateRecord({ modelUsage: {} })).weight())
    })
  })
})
