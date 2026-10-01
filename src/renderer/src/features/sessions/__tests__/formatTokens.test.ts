import { describe, expect, it } from 'vitest'
import { formatTokens } from '../formatTokens'
import { testSessionsT as t } from '../testSessionsT'

describe('formatTokens', () => {
  it('formats one token with a singular label', () => {
    expect(formatTokens(1, t)).toBe('1 token')
  })

  it('formats a large count in short compact notation', () => {
    expect(formatTokens(12_400_000, t)).toBe('12.4M tokens')
  })

  it('formats zero as a known count', () => {
    expect(formatTokens(0, t)).toBe('0 tokens')
  })

  it('reports no text for an unknown count', () => {
    expect(formatTokens(null, t)).toBeNull()
  })
})
