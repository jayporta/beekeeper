import { describe, expect, it } from 'vitest'
import { costStateRecordSchema } from '../../transcript/schemas'
import { buildCostStateRecord } from '../../transcript/testFixtures'
import { createRecordedCostState, RECORDED_MODEL_OVERHEAD } from '../recordedCostState'
import { reconcileUsage } from '../reconcileUsage'

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

  it('reconciles exactly as the full record does', () => {
    const record = buildCostStateRecord({
      totalCostUSD: 9.5,
      unknownTopLevel: { nested: true },
      modelUsage: {
        'claude-opus-5[1m]': FULL_ENTRY,
        'claude-opus-5': { inputTokens: 10, costUSD: 1 },
        'claude-haiku-5': { outputTokens: 7, extra: 'dropped' },
        ['unprintable\u0007key']: FULL_ENTRY
      }
    })
    const input = { agents: [], unreadableAgents: 0 }

    expect(reconcileUsage({ ...input, costState: observed(record).latest() })).toEqual(
      reconcileUsage({ ...input, costState: costStateRecordSchema.parse(record) })
    )
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
