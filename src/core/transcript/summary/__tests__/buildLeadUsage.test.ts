import { describe, expect, it } from 'vitest'
import { emptyTokenCounts } from '../../../pricing/tokenCounts'
import { QUARTER_HOUR_MS } from '../../../shared/quarterHour'
import { buildLeadUsage, type TrackedMessage } from '../buildLeadUsage'
import type { LeadUsage } from '../leadUsage'

const MODEL = 'claude-opus-5'

function tracked(overrides: Partial<TrackedMessage> & { readonly input?: number }): TrackedMessage {
  const { input = 10, ...rest } = overrides
  return {
    model: MODEL,
    tokens: { ...emptyTokenCounts, input },
    earliestMs: Date.parse('2026-01-01T12:00:00.000Z'),
    ...rest
  }
}

function build(entries: readonly (readonly [string, TrackedMessage])[], invalid = 0): LeadUsage {
  return buildLeadUsage({ messages: new Map(entries), invalidAssistantRecords: invalid })
}

const slotOf = (iso: string): number => Math.floor(Date.parse(iso) / QUARTER_HOUR_MS)

describe('buildLeadUsage', () => {
  it('sums two messages in one slot and model', () => {
    const { slots } = build([
      ['a', tracked({ input: 10 })],
      ['b', tracked({ input: 5 })]
    ])

    expect(slots).toEqual([{ slot: slotOf('2026-01-01T12:00:00.000Z'), model: MODEL, tokens: 15 }])
  })

  it('puts a message at 12:14:59.999 and one at 12:15:00.000 in adjacent slots', () => {
    const { slots } = build([
      ['a', tracked({ earliestMs: Date.parse('2026-01-01T12:15:00.000Z') })],
      ['b', tracked({ earliestMs: Date.parse('2026-01-01T12:14:59.999Z') })]
    ])

    // Quarter hours since the Unix epoch.
    expect(slots.map((s) => s.slot)).toEqual([1_963_632, 1_963_633])
  })

  it('keeps separate models in one slot apart, sorted by model', () => {
    const { slots } = build([
      ['a', tracked({ model: 'claude-sonnet-5' })],
      ['b', tracked({ model: 'claude-haiku-5' })]
    ])

    expect(slots.map((s) => s.model)).toEqual(['claude-haiku-5', 'claude-sonnet-5'])
  })

  it('normalizes the model before grouping', () => {
    const { slots } = build([
      ['a', tracked({ model: 'claude-opus-5-20260101' })],
      ['b', tracked({ model: 'claude-opus-5' })]
    ])

    expect(slots).toEqual([{ slot: slotOf('2026-01-01T12:00:00.000Z'), model: MODEL, tokens: 20 }])
  })

  it('sorts by slot before model', () => {
    const { slots } = build([
      ['a', tracked({ model: 'a-model', earliestMs: Date.parse('2026-01-01T13:00:00.000Z') })],
      ['b', tracked({ model: 'z-model', earliestMs: Date.parse('2026-01-01T12:00:00.000Z') })]
    ])

    expect(slots.map((s) => s.model)).toEqual(['z-model', 'a-model'])
  })

  it('leaves synthetic and zero-token messages out of the slots but keeps their ids', () => {
    const usage = build([
      ['syn', tracked({ model: '<synthetic>' })],
      ['zero', tracked({ input: 0 })]
    ])

    expect(usage.slots).toEqual([])
    expect([...usage.messageIds]).toEqual(['syn', 'zero'])
  })

  it('counts a counted message with no timestamp as undated and keeps its id', () => {
    const usage = build([['a', tracked({ earliestMs: null })]])

    expect(usage.slots).toEqual([])
    expect(usage.undatedMessages).toBe(1)
    expect(usage.messageIds.has('a')).toBe(true)
  })

  it('does not count an undated synthetic message as undated', () => {
    const usage = build([['a', tracked({ model: '<synthetic>', earliestMs: null })]])

    expect(usage.undatedMessages).toBe(0)
  })

  it('passes the invalid assistant record count through', () => {
    expect(build([], 3).invalidAssistantRecords).toBe(3)
  })
})
