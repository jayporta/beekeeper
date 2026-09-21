import { describe, expect, it } from 'vitest'
import { priceTokens } from '../priceTokens'
import { emptyTokenCounts, type TokenCounts } from '../tokenCounts'

const nonzeroTokens: TokenCounts = {
  input: 100_000,
  output: 50_000,
  cacheRead: 20_000,
  cacheWrite5m: 10_000,
  cacheWrite1h: 5_000
}

describe('priceTokens', () => {
  it('prices every token class at the standard rate for a known model', () => {
    const result = priceTokens({
      model: 'claude-sonnet-5',
      speed: 'standard',
      tokens: nonzeroTokens
    })

    // 100_000 * 2 + 50_000 * 10 + 20_000 * 0.2 + 10_000 * 2.5 + 5_000 * 4, all / 1e6
    if (result.kind !== 'priced') throw new Error('expected a priced result')
    expect(result.usd).toBeCloseTo(0.749, 9)
  })

  it('returns unpriced, not $0, for an unknown model even with zero tokens', () => {
    const result = priceTokens({
      model: 'claude-unreleased-9',
      speed: 'standard',
      tokens: emptyTokenCounts
    })

    expect(result).toEqual({ kind: 'unpriced', reason: 'unknown-model' })
  })

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'returns unpriced for the inherited Object.prototype property %s, not a crash',
    (model) => {
      const result = priceTokens({ model, speed: 'standard', tokens: emptyTokenCounts })

      expect(result).toEqual({ kind: 'unpriced', reason: 'unknown-model' })
    }
  )

  it('treats the synthetic placeholder model as free regardless of tokens', () => {
    const result = priceTokens({ model: '<synthetic>', speed: 'standard', tokens: nonzeroTokens })

    expect(result).toEqual({ kind: 'free' })
  })

  it('treats an absent speed as standard', () => {
    const result = priceTokens({
      model: 'claude-sonnet-5',
      speed: undefined,
      tokens: nonzeroTokens
    })

    expect(result.kind).toBe('priced')
  })

  it('treats a null speed as standard', () => {
    const result = priceTokens({ model: 'claude-sonnet-5', speed: null, tokens: nonzeroTokens })

    expect(result.kind).toBe('priced')
  })

  it('returns unknown-speed for a speed string with no price entry', () => {
    const result = priceTokens({ model: 'claude-sonnet-5', speed: 'fast', tokens: nonzeroTokens })

    expect(result).toEqual({ kind: 'unpriced', reason: 'unknown-speed' })
  })

  it('returns unknown-speed for a non-string speed value', () => {
    const result = priceTokens({ model: 'claude-sonnet-5', speed: 42, tokens: nonzeroTokens })

    expect(result).toEqual({ kind: 'unpriced', reason: 'unknown-speed' })
  })

  it('prices a dated haiku id against the base haiku price', () => {
    const result = priceTokens({
      model: 'claude-haiku-4-5-20260315',
      speed: 'standard',
      tokens: { ...emptyTokenCounts, input: 1_000_000 }
    })

    expect(result).toEqual({ kind: 'priced', usd: 1 })
  })

  it('prices a bracketed opus id against the base opus price', () => {
    const result = priceTokens({
      model: 'claude-opus-5[1m]',
      speed: 'standard',
      tokens: { ...emptyTokenCounts, output: 1_000_000 }
    })

    expect(result).toEqual({ kind: 'priced', usd: 25 })
  })
})
