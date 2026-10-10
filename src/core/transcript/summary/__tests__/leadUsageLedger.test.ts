import { describe, expect, it } from 'vitest'
import { countedUsage } from '../../../pricing/countedUsage'
import { emptyTokenCounts } from '../../../pricing/tokenCounts'
import { totalTokenCount } from '../../../pricing/totalTokenCount'
import { QUARTER_HOUR_MS } from '../../../shared/quarterHour'
import type { LeadUsageSlot } from '../leadUsage'
import {
  createLeadUsageLedger,
  LEDGER_SLOT_OVERHEAD,
  type LeadUsageLedger,
  type TrackedMessage
} from '../leadUsageLedger'

const MODEL = 'claude-opus-5'
const NOON = Date.parse('2026-01-01T12:00:00.000Z')

function tracked(overrides: Partial<TrackedMessage> & { readonly input?: number }): TrackedMessage {
  const { input = 10, ...rest } = overrides
  return { model: MODEL, tokens: { ...emptyTokenCounts, input }, earliestMs: NOON, ...rest }
}

/** A ledger that has been told about each message as new. */
function ledgerOf(messages: readonly TrackedMessage[]): LeadUsageLedger {
  const ledger = createLeadUsageLedger()
  for (const message of messages) ledger.update({ before: undefined, after: message })
  return ledger
}

const slotOf = (iso: string): number => Math.floor(Date.parse(iso) / QUARTER_HOUR_MS)

/** The same answers computed from scratch over the final messages, which the ledger must match. */
function fromScratch(messages: readonly TrackedMessage[]): {
  slots: LeadUsageSlot[]
  undated: number
  total: number
} {
  const bySlot = new Map<string, LeadUsageSlot>()
  let undated = 0
  let total = 0
  for (const message of messages) {
    total += totalTokenCount(message.tokens)
    const counted = countedUsage(message)
    if (counted === null) continue
    if (message.earliestMs === null) {
      undated += 1
      continue
    }
    const slot = Math.floor(message.earliestMs / QUARTER_HOUR_MS)
    const key = `${slot}\0${counted.model}`
    const existing = bySlot.get(key)
    if (existing === undefined)
      bySlot.set(key, { slot, model: counted.model, tokens: counted.tokens })
    else bySlot.set(key, { ...existing, tokens: existing.tokens + counted.tokens })
  }
  const slots = [...bySlot.values()].sort(
    (a, b) => a.slot - b.slot || a.model.localeCompare(b.model)
  )
  return { slots, undated, total }
}

describe('createLeadUsageLedger', () => {
  it('sums two messages in one slot and model', () => {
    const ledger = ledgerOf([tracked({ input: 10 }), tracked({ input: 5 })])

    expect(ledger.slots()).toEqual([
      { slot: slotOf('2026-01-01T12:00:00.000Z'), model: MODEL, tokens: 15 }
    ])
  })

  it('puts a message at 12:14:59.999 and one at 12:15:00.000 in adjacent slots', () => {
    const ledger = ledgerOf([
      tracked({ earliestMs: Date.parse('2026-01-01T12:15:00.000Z') }),
      tracked({ earliestMs: Date.parse('2026-01-01T12:14:59.999Z') })
    ])

    // Quarter hours since the Unix epoch.
    expect(ledger.slots().map((s) => s.slot)).toEqual([1_963_632, 1_963_633])
  })

  it('keeps separate models in one slot apart, sorted by model', () => {
    const ledger = ledgerOf([
      tracked({ model: 'claude-sonnet-5' }),
      tracked({ model: 'claude-haiku-5' })
    ])

    expect(ledger.slots().map((s) => s.model)).toEqual(['claude-haiku-5', 'claude-sonnet-5'])
  })

  it('normalizes the model before grouping', () => {
    const ledger = ledgerOf([tracked({ model: 'claude-opus-5-20260101' }), tracked({})])

    expect(ledger.slots()).toEqual([
      { slot: slotOf('2026-01-01T12:00:00.000Z'), model: MODEL, tokens: 20 }
    ])
  })

  it('sorts by slot before model', () => {
    const ledger = ledgerOf([
      tracked({ model: 'a-model', earliestMs: Date.parse('2026-01-01T13:00:00.000Z') }),
      tracked({ model: 'z-model', earliestMs: Date.parse('2026-01-01T12:00:00.000Z') })
    ])

    expect(ledger.slots().map((s) => s.model)).toEqual(['z-model', 'a-model'])
  })

  it('leaves synthetic and zero-token messages out of the slots', () => {
    const ledger = ledgerOf([tracked({ model: '<synthetic>' }), tracked({ input: 0 })])

    expect(ledger.slots()).toEqual([])
  })

  it('counts a counted message with no timestamp as undated', () => {
    const ledger = ledgerOf([tracked({ earliestMs: null })])

    expect(ledger.slots()).toEqual([])
    expect(ledger.undatedMessages()).toBe(1)
  })

  it('does not count an undated synthetic message as undated', () => {
    const ledger = ledgerOf([tracked({ model: '<synthetic>', earliestMs: null })])

    expect(ledger.undatedMessages()).toBe(0)
  })

  describe('update', () => {
    it('replaces a message tokens with its new ones instead of adding to them', () => {
      const ledger = ledgerOf([tracked({ input: 10 })])

      ledger.update({ before: tracked({ input: 10 }), after: tracked({ input: 25 }) })

      expect(ledger.slots().map((s) => s.tokens)).toEqual([25])
      expect(ledger.totalTokens()).toBe(25)
    })

    it('moves a message to the slot of its earlier timestamp', () => {
      const later = tracked({ earliestMs: Date.parse('2026-01-01T13:00:00.000Z') })
      const ledger = ledgerOf([later])

      ledger.update({ before: later, after: { ...later, earliestMs: NOON } })

      expect(ledger.slots()).toEqual([
        { slot: slotOf('2026-01-01T12:00:00.000Z'), model: MODEL, tokens: 10 }
      ])
    })

    it('drops a slot once its last message has moved away', () => {
      const later = tracked({ earliestMs: Date.parse('2026-01-01T13:00:00.000Z') })
      const ledger = ledgerOf([later, tracked({})])

      ledger.update({ before: later, after: { ...later, earliestMs: NOON } })

      expect(ledger.slots()).toHaveLength(1)
    })

    it('turns an undated message into a dated one when a timestamp arrives', () => {
      const undated = tracked({ earliestMs: null })
      const ledger = ledgerOf([undated])

      ledger.update({ before: undated, after: { ...undated, earliestMs: NOON } })

      expect(ledger.undatedMessages()).toBe(0)
      expect(ledger.slots()).toHaveLength(1)
    })

    it('counts a message that has grown from no tokens to some', () => {
      const empty = tracked({ input: 0 })
      const ledger = ledgerOf([empty])

      ledger.update({ before: empty, after: tracked({ input: 7 }) })

      expect(ledger.slots().map((s) => s.tokens)).toEqual([7])
    })

    it('stops counting a message whose tokens are no longer finite', () => {
      const ledger = ledgerOf([tracked({ input: 10 }), tracked({ input: 5 })])

      ledger.update({ before: tracked({ input: 10 }), after: tracked({ input: Infinity }) })

      expect(ledger.slots().map((s) => s.tokens)).toEqual([5])
      expect(ledger.totalTokens()).toBeNull()
    })

    it('matches a total worked out from scratch after a run of merges', () => {
      const finals: TrackedMessage[] = []
      const ledger = createLeadUsageLedger()
      for (let n = 0; n < 40; n += 1) {
        const first = tracked({
          model: n % 3 === 0 ? 'claude-sonnet-5' : MODEL,
          input: n % 5,
          earliestMs: n % 7 === 0 ? null : NOON + n * 400_000
        })
        ledger.update({ before: undefined, after: first })
        let current = first
        for (const grown of [n * 2, n * 3 + 1]) {
          const next = {
            ...current,
            tokens: { ...current.tokens, output: Math.max(current.tokens.output, grown) },
            earliestMs:
              current.earliestMs === null || n % 2 === 0
                ? current.earliestMs
                : current.earliestMs - 2_000_000
          }
          ledger.update({ before: current, after: next })
          current = next
        }
        finals.push(current)
      }

      const expected = fromScratch(finals)
      expect(ledger.slots()).toEqual(expected.slots)
      expect(ledger.undatedMessages()).toBe(expected.undated)
      expect(ledger.totalTokens()).toBe(expected.total)
    })
  })

  describe('slots', () => {
    it('reflects an update made after the slots were last read', () => {
      const ledger = ledgerOf([tracked({ input: 10 })])
      ledger.slots()

      ledger.update({ before: tracked({ input: 10 }), after: tracked({ input: 99 }) })

      expect(ledger.slots().map((s) => s.tokens)).toEqual([99])
    })

    it('returns a list that later updates do not change', () => {
      const ledger = ledgerOf([tracked({ input: 10 })])
      const earlier = ledger.slots()
      const snapshot = structuredClone(earlier)

      ledger.update({ before: tracked({ input: 10 }), after: tracked({ input: 99 }) })
      ledger.update({ before: undefined, after: tracked({ earliestMs: NOON + QUARTER_HOUR_MS }) })

      expect(earlier).toEqual(snapshot)
    })
  })

  describe('weight', () => {
    it('is zero before any message', () => {
      expect(createLeadUsageLedger().weight()).toBe(0)
    })

    it('charges each slot and model its overhead and its key, the slot and the model', () => {
      const ledger = ledgerOf([tracked({}), tracked({})])

      expect(ledger.weight()).toBe(
        LEDGER_SLOT_OVERHEAD + String(slotOf('2026-01-01T12:00:00.000Z')).length + 1 + MODEL.length
      )
    })

    it('charges another slot for a message in a different slot', () => {
      const one = ledgerOf([tracked({})])
      const two = ledgerOf([
        tracked({}),
        tracked({ earliestMs: Date.parse('2026-01-01T13:00:00.000Z') })
      ])

      expect(two.weight()).toBe(2 * one.weight())
    })

    it('frees a slot once its last message has moved away', () => {
      const later = tracked({ earliestMs: Date.parse('2026-01-01T13:00:00.000Z') })
      const ledger = ledgerOf([later, tracked({})])

      ledger.update({ before: later, after: { ...later, earliestMs: NOON } })

      expect(ledger.weight()).toBe(ledgerOf([tracked({})]).weight())
    })

    it('charges nothing for undated messages', () => {
      expect(ledgerOf([tracked({ earliestMs: null })]).weight()).toBe(0)
    })
  })

  describe('totalTokens', () => {
    it('is zero before any message', () => {
      expect(createLeadUsageLedger().totalTokens()).toBe(0)
    })

    it('is null when two finite messages sum past what a number holds', () => {
      const ledger = ledgerOf([tracked({ input: 1e308 }), tracked({ input: 1e308 })])

      expect(ledger.totalTokens()).toBeNull()
    })
  })
})
