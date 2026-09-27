import { describe, expect, it } from 'vitest'
import { parsePriceTable, priceTable, priceTableModels } from '../priceTable'

const validEntry = { input: 1, output: 1, cacheRead: 1, cacheWrite5m: 1, cacheWrite1h: 1 }

const CURRENT_MODEL_IDS = [
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5'
]

describe('priceTable', () => {
  it('cites an https source URL', () => {
    expect(new URL(priceTable.source).protocol).toBe('https:')
  })

  it('records a parseable as-of date', () => {
    expect(Number.isNaN(Date.parse(priceTable.asOf))).toBe(false)
  })

  it.each(CURRENT_MODEL_IDS)('prices %s', (modelId) => {
    expect(priceTableModels.has(modelId)).toBe(true)
  })

  it('prices cache reads per model rather than by a family multiplier', () => {
    expect(priceTableModels.get('claude-opus-5-5')?.standard.cacheRead).toBe(0.2)
    expect(priceTableModels.get('claude-fable-5')?.standard.cacheRead).toBe(1)
    expect(priceTableModels.get('claude-fable-5-1')?.standard.cacheRead).toBe(0.25)
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
