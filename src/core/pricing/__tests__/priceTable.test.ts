import { describe, expect, it } from 'vitest'
import { parsePriceTable, priceTable, priceTableModels } from '../priceTable'

const validEntry = { input: 1, output: 1, cacheRead: 1, cacheWrite5m: 1, cacheWrite1h: 1 }

const PRICED_MODEL_IDS = [
  'claude-fable-5-1',
  'claude-fable-5',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-opus-4-5',
  'claude-opus-4-1',
  'claude-opus-4',
  'claude-sonnet-5-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
  'claude-sonnet-4-5',
  'claude-sonnet-4',
  'claude-haiku-4-5',
  'claude-3-5-haiku'
]

const PINNED_RATES = [
  [
    'claude-sonnet-5-5',
    { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5, cacheWrite1h: 4 }
  ],
  [
    'claude-opus-4-5',
    { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 }
  ],
  [
    'claude-sonnet-4-5',
    { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 }
  ],
  [
    'claude-opus-4-1',
    { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 }
  ],
  [
    'claude-opus-4',
    { input: 15, output: 75, cacheRead: 1.5, cacheWrite5m: 18.75, cacheWrite1h: 30 }
  ],
  [
    'claude-sonnet-4',
    { input: 3, output: 15, cacheRead: 0.3, cacheWrite5m: 3.75, cacheWrite1h: 6 }
  ],
  [
    'claude-3-5-haiku',
    { input: 0.8, output: 4, cacheRead: 0.08, cacheWrite5m: 1, cacheWrite1h: 1.6 }
  ]
] as const

describe('priceTable', () => {
  it('cites an https source URL', () => {
    expect(new URL(priceTable.source).protocol).toBe('https:')
  })

  it('records a parseable as-of date', () => {
    expect(Number.isNaN(Date.parse(priceTable.asOf))).toBe(false)
  })

  it.each(PRICED_MODEL_IDS)('prices %s', (modelId) => {
    expect(priceTableModels.has(modelId)).toBe(true)
  })

  it.each(PINNED_RATES)('prices %s at the pricing page rates', (modelId, rates) => {
    expect(priceTableModels.get(modelId)?.standard).toEqual(rates)
  })

  it.each([
    [
      'claude-opus-5-5',
      { input: 8, output: 40, cacheRead: 0.4, cacheWrite5m: 10, cacheWrite1h: 16 }
    ],
    [
      'claude-opus-5',
      { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 }
    ],
    [
      'claude-opus-4-8',
      { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 12.5, cacheWrite1h: 20 }
    ]
  ] as const)('prices %s fast mode at the pricing page rates', (modelId, rates) => {
    expect(priceTableModels.get(modelId)?.fast).toEqual(rates)
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

  it('accepts a model with a fast entry beside its standard entry', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: validEntry, fast: validEntry } }
    }

    expect(parsePriceTable(raw).models['claude-x']?.fast).toEqual(validEntry)
  })

  it('accepts a model with no fast entry', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: validEntry } }
    }

    expect(parsePriceTable(raw).models['claude-x']?.fast).toBeUndefined()
  })

  it('throws when a model carries an unknown speed key', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { standard: validEntry, Fast: validEntry } }
    }

    expect(() => parsePriceTable(raw)).toThrow()
  })

  it('throws when a model has fast but no standard entry', () => {
    const raw = {
      source: 'https://example.com/pricing',
      asOf: '2026-01-01',
      models: { 'claude-x': { fast: validEntry } }
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
