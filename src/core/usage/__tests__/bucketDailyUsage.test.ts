import { describe, expect, it } from 'vitest'
import { emptyTokenCounts, type TokenCounts } from '../../pricing/tokenCounts'
import { leadIdentity } from '../../session/agentIdentity'
import type { LedgerEntry } from '../../session/usageLedger'
import { bucketDailyUsage } from '../bucketDailyUsage'

const dayKeyOf = (epochMs: number): string => (epochMs < 1000 ? 'd1' : 'd2')

function entry(
  overrides: Omit<Partial<LedgerEntry>, 'tokens'> & { readonly tokens?: Partial<TokenCounts> }
): LedgerEntry {
  const { tokens, ...rest } = overrides
  return {
    messageId: 'msg',
    owner: leadIdentity,
    model: 'claude-opus-5',
    speed: undefined,
    tokens: { ...emptyTokenCounts, input: 10, ...tokens },
    earliestMs: 0,
    latestMs: 0,
    ...rest
  }
}

describe('bucketDailyUsage', () => {
  it('sums entries of the same day and model into one bucket', () => {
    const { buckets } = bucketDailyUsage(
      [
        entry({ messageId: 'a', tokens: { input: 10 } }),
        entry({ messageId: 'b', tokens: { input: 5, output: 1 } })
      ],
      dayKeyOf
    )

    expect(buckets).toEqual([{ day: 'd1', model: 'claude-opus-5', tokens: 16 }])
  })

  it('keeps one bucket per model on a day, sorted by day then model', () => {
    const { buckets } = bucketDailyUsage(
      [
        entry({ messageId: 'a', model: 'claude-sonnet-5', earliestMs: 2000 }),
        entry({ messageId: 'b', model: 'claude-sonnet-5', earliestMs: 0 }),
        entry({ messageId: 'c', model: 'claude-haiku-5', earliestMs: 0 })
      ],
      dayKeyOf
    )

    expect(buckets.map((b) => `${b.day} ${b.model}`)).toEqual([
      'd1 claude-haiku-5',
      'd1 claude-sonnet-5',
      'd2 claude-sonnet-5'
    ])
  })

  it('merges model id variants with a date or bracketed suffix', () => {
    const { buckets } = bucketDailyUsage(
      [
        entry({ messageId: 'a', model: 'claude-opus-5-20251101' }),
        entry({ messageId: 'b', model: 'claude-opus-5[1m]' })
      ],
      dayKeyOf
    )

    expect(buckets).toEqual([{ day: 'd1', model: 'claude-opus-5', tokens: 20 }])
  })

  it('counts a message with no timestamp as undated and leaves it out of every bucket', () => {
    const result = bucketDailyUsage([entry({ earliestMs: null, latestMs: null })], dayKeyOf)

    expect(result).toEqual({ buckets: [], undatedMessages: 1 })
  })

  it('excludes <synthetic> messages without counting them as undated', () => {
    const result = bucketDailyUsage(
      [
        entry({ model: '<synthetic>', earliestMs: null, latestMs: null }),
        entry({ model: '<synthetic>' })
      ],
      dayKeyOf
    )

    expect(result).toEqual({ buckets: [], undatedMessages: 0 })
  })

  it('makes no bucket for a message with no tokens', () => {
    const result = bucketDailyUsage([entry({ tokens: { input: 0 } })], dayKeyOf)

    expect(result).toEqual({ buckets: [], undatedMessages: 0 })
  })

  it('excludes a message whose token total is not finite', () => {
    const result = bucketDailyUsage([entry({ tokens: { input: Infinity } })], dayKeyOf)

    expect(result).toEqual({ buckets: [], undatedMessages: 0 })
  })
})
