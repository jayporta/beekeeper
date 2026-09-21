import { describe, expect, it } from 'vitest'
import { parsePriceTable, priceTable } from '../priceTable'

const validEntry = { input: 1, output: 1, cacheRead: 1, cacheWrite5m: 1, cacheWrite1h: 1 }

describe('priceTable', () => {
  it('cites an https source URL', () => {
    expect(new URL(priceTable.source).protocol).toBe('https:')
  })

  it('records a parseable as-of date', () => {
    expect(Number.isNaN(Date.parse(priceTable.asOf))).toBe(false)
  })
})

describe('parsePriceTable', () => {
  it('accepts a well-formed table', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: validEntry } }
    }

    expect(() => parsePriceTable(raw)).not.toThrow()
  })

  it('throws when a price entry is missing a token class', () => {
    const missingClass = { input: 1, output: 1, cacheRead: 1, cacheWrite5m: 1 }
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: missingClass } }
    }

    expect(() => parsePriceTable(raw)).toThrow()
  })

  it('throws when a price entry has an extra token class', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: { ...validEntry, fast: 1 } } }
    }

    expect(() => parsePriceTable(raw)).toThrow()
  })

  it('throws when a model is missing the standard speed', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': {} }
    }

    expect(() => parsePriceTable(raw)).toThrow()
  })

  it('throws when a price is not a number', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: { ...validEntry, input: '5' } } }
    }

    expect(() => parsePriceTable(raw)).toThrow()
  })
})
