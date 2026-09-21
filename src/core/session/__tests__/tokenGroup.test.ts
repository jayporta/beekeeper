import { describe, expect, it } from 'vitest'
import { emptyTokenCounts } from '../../pricing/tokenCounts'
import { leadIdentity } from '../agentIdentity'
import { groupTokensByModelAndSpeed } from '../tokenGroup'
import type { LedgerEntry } from '../usageLedger'

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    messageId: 'msg_1',
    owner: leadIdentity,
    model: 'claude-sonnet-5',
    speed: undefined,
    tokens: { ...emptyTokenCounts, input: 1_000_000 },
    ...overrides
  }
}

describe('groupTokensByModelAndSpeed', () => {
  it('merges an absent speed with an explicit standard speed into one group', () => {
    const groups = groupTokensByModelAndSpeed([
      entry({ messageId: 'a', speed: undefined }),
      entry({ messageId: 'b', speed: 'standard' })
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ model: 'claude-sonnet-5', speed: 'standard' })
  })

  it('sums token counts within a group', () => {
    const groups = groupTokensByModelAndSpeed([
      entry({ messageId: 'a', tokens: { ...emptyTokenCounts, input: 100_000 } }),
      entry({ messageId: 'b', tokens: { ...emptyTokenCounts, input: 50_000 } })
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.tokens.input).toBe(150_000)
  })

  it('separates a different raw model into its own group', () => {
    const groups = groupTokensByModelAndSpeed([
      entry({ messageId: 'a', model: 'claude-sonnet-5' }),
      entry({ messageId: 'b', model: 'claude-opus-5' })
    ])

    expect(groups.map((group) => group.model).sort()).toEqual(['claude-opus-5', 'claude-sonnet-5'])
  })

  it('separates an explicit unpriced speed into its own group', () => {
    const groups = groupTokensByModelAndSpeed([
      entry({ messageId: 'a', speed: undefined }),
      entry({ messageId: 'b', speed: 'fast' })
    ])

    expect(groups).toHaveLength(2)
    const fastGroup = groups.find((group) => group.speed === 'fast')
    expect(fastGroup?.price).toEqual({ kind: 'unpriced', reason: 'unknown-speed' })
  })

  it('prices a known model at the standard rate', () => {
    const groups = groupTokensByModelAndSpeed([
      entry({ model: 'claude-sonnet-5', tokens: { ...emptyTokenCounts, output: 1_000_000 } })
    ])

    expect(groups[0]?.price).toEqual({ kind: 'priced', usd: 10 })
  })

  it('returns unpriced, not $0, for an unknown model', () => {
    const groups = groupTokensByModelAndSpeed([entry({ model: 'claude-unreleased-9' })])

    expect(groups[0]?.price).toEqual({ kind: 'unpriced', reason: 'unknown-model' })
  })
})
