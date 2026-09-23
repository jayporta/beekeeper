import { describe, expect, it } from 'vitest'
import { createLastCostState } from '../lastCostState'
import { buildAssistantRecord, buildCostStateRecord } from '../testFixtures'

describe('createLastCostState', () => {
  it('reports null when no cost-state was observed', () => {
    const reducer = createLastCostState()
    reducer.observe(buildAssistantRecord())

    expect(reducer.latest()).toBeNull()
  })

  it('keeps the last cost-state, since records are cumulative', () => {
    const reducer = createLastCostState()
    reducer.observe(buildCostStateRecord({ totalCostUSD: 1 }))
    reducer.observe(buildCostStateRecord({ totalCostUSD: 2 }))

    expect(reducer.latest()?.totalCostUSD).toBe(2)
  })

  it('keeps an earlier valid cost-state when a later one is malformed', () => {
    const reducer = createLastCostState()
    reducer.observe(buildCostStateRecord({ totalCostUSD: 1 }))
    reducer.observe({ type: 'cost-state', totalCostUSD: 'free' })

    expect(reducer.latest()?.totalCostUSD).toBe(1)
  })
})
