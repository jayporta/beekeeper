import { describe, expect, it } from 'vitest'
import { reconcileUsage } from '../reconcileUsage'
import { agent, costState, group } from '../testReconcileFixtures'

describe('reconcileUsage', () => {
  it('sums agents, speeds, and raw ids under one normalized model', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [
        agent(
          group('claude-opus-5', { tokens: { input: 1, output: 2, cacheRead: 3 } }),
          group('claude-opus-5[1m]', { speed: 'fast', tokens: { input: 10 } })
        ),
        agent(group('claude-opus-5', { tokens: { input: 100 } }))
      ],
      costState: null
    })

    expect(result.models).toHaveLength(1)
    expect(result.models[0]?.transcript).toEqual({
      input: 111,
      output: 2,
      cacheRead: 3,
      cacheWrite: 0,
      usd: 3,
      partial: false
    })
  })

  it('reports cache writes as the 5m and 1h tiers together', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [agent(group('claude-opus-5', { tokens: { cacheWrite5m: 4, cacheWrite1h: 6 } }))],
      costState: null
    })

    expect(result.models[0]?.transcript?.cacheWrite).toBe(10)
  })

  it('flags a model partial and leaves its unpriced group out of the USD', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [
        agent(
          group('claude-opus-5', { price: { kind: 'priced', usd: 2 } }),
          group('claude-opus-5', {
            speed: 'fast',
            price: { kind: 'unpriced', reason: 'unknown-speed' }
          })
        )
      ],
      costState: null
    })

    expect(result.models[0]?.transcript).toMatchObject({ usd: 2, partial: true })
    expect(result.totals).toMatchObject({ transcriptUSD: 2, transcriptPartial: true })
  })

  it('reports null USD, not $0, for a model and totals with only unpriced groups', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [
        agent(group('mystery-model', { price: { kind: 'unpriced', reason: 'unknown-model' } }))
      ],
      costState: null
    })

    expect(result.models[0]?.transcript).toMatchObject({ usd: null, partial: true })
    expect(result.totals).toMatchObject({ transcriptUSD: null, transcriptPartial: true })
  })

  it('reports a null total, not $0, when free groups sit beside unpriced ones', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [
        agent(
          group('<synthetic>', { price: { kind: 'free' } }),
          group('mystery-model', { price: { kind: 'unpriced', reason: 'unknown-model' } })
        )
      ],
      costState: null
    })

    expect(result.totals).toMatchObject({ transcriptUSD: null, transcriptPartial: true })
  })

  it('reports a null model USD, not $0, when a $0 priced group sits beside an unpriced one', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [
        agent(
          group('claude-opus-5', { price: { kind: 'priced', usd: 0 } }),
          group('claude-opus-5', {
            speed: 'fast',
            price: { kind: 'unpriced', reason: 'unknown-speed' }
          })
        )
      ],
      costState: null
    })

    expect(result.models[0]?.transcript).toMatchObject({ usd: null, partial: true })
  })

  it('does not flag a free model partial', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [agent(group('<synthetic>', { price: { kind: 'free' } }))],
      costState: null
    })

    expect(result.totals).toMatchObject({ transcriptUSD: 0, transcriptPartial: false })
  })

  it('sums several recorded raw keys under one normalized model', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [],
      costState: costState({
        modelUsage: {
          'claude-opus-5[1m]': {
            inputTokens: 1,
            outputTokens: 2,
            cacheReadInputTokens: 3,
            cacheCreationInputTokens: 4,
            costUSD: 0.5
          },
          'claude-opus-5': {
            inputTokens: 10,
            costUSD: 0.25,
            thinkingTokens: 99,
            webSearchRequests: 9
          }
        }
      })
    })

    expect(result.models[0]?.recorded).toEqual({
      input: 11,
      output: 2,
      cacheRead: 3,
      cacheWrite: 4,
      costUSD: 0.75,
      partial: false
    })
  })

  const costed = ['claude-opus-5[1m]', { inputTokens: 1, costUSD: 0.5 }] as const
  const uncosted = ['claude-opus-5', { inputTokens: 1 }] as const

  it.each([
    ['before', [costed, uncosted]],
    ['after', [uncosted, costed]]
  ] as const)(
    'flags a recorded model partial when the key with a cost comes %s the one without',
    (_order, entries) => {
      const result = reconcileUsage({
        unreadableAgents: 0,
        agents: [],
        costState: costState({ modelUsage: Object.fromEntries(entries) })
      })

      expect(result.models[0]?.recorded).toMatchObject({ costUSD: 0.5, partial: true })
    }
  )

  it('reports a null recorded cost, not $0, when a $0 key sits beside one with no cost', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [],
      costState: costState({
        modelUsage: {
          'claude-opus-5[1m]': { inputTokens: 1, costUSD: 0 },
          'claude-opus-5': { inputTokens: 1 }
        }
      })
    })

    expect(result.models[0]?.recorded).toMatchObject({ costUSD: null, partial: true })
  })

  it('flags totals partial when a subagent transcript was unreadable', () => {
    const result = reconcileUsage({
      unreadableAgents: 1,
      agents: [agent(group('<synthetic>', { price: { kind: 'free' } }))],
      costState: null
    })

    expect(result.totals).toMatchObject({ transcriptUSD: null, transcriptPartial: true })
  })

  it('flags totals partial when a readable agent skipped lines', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [agent(group('claude-opus-5')), { ...agent(), skippedLines: 1 }],
      costState: null
    })

    expect(result.totals).toMatchObject({ transcriptUSD: 1, transcriptPartial: true })
  })

  it('reports a recorded cost of null when no entry carried one', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [],
      costState: costState({ modelUsage: { 'claude-opus-5': { inputTokens: 1 } } })
    })

    expect(result.models[0]?.recorded?.costUSD).toBeNull()
  })

  it('gives a one-sided model a row with the other side null, sorted by id', () => {
    const result = reconcileUsage({
      unreadableAgents: 0,
      agents: [agent(group('<synthetic>', { price: { kind: 'free' } }))],
      costState: costState({ modelUsage: { 'claude-haiku-4-5': { outputTokens: 1 } } })
    })

    expect(
      result.models.map((row) => [row.model, row.transcript === null, row.recorded === null])
    ).toEqual([
      ['<synthetic>', false, true],
      ['claude-haiku-4-5', true, false]
    ])
  })

  it('reports a null recorded total when there is no cost-state or no total', () => {
    expect(
      reconcileUsage({ unreadableAgents: 0, agents: [], costState: null }).totals.recordedUSD
    ).toBeNull()
    expect(
      reconcileUsage({ unreadableAgents: 0, agents: [], costState: costState({}) }).totals
        .recordedUSD
    ).toBeNull()
    expect(
      reconcileUsage({ unreadableAgents: 0, agents: [], costState: costState({ totalCostUSD: 3 }) })
        .totals.recordedUSD
    ).toBe(3)
  })
})
