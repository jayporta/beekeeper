import { describe, expect, it } from 'vitest'
import { collectOtlpAttributes, readOtlpNumber } from '../otlpAttributes'
import { otlpAttributes } from '../testOtlpLogs'

describe('collectOtlpAttributes', () => {
  it('keeps only the wanted keys', () => {
    const list = otlpAttributes({ model: 'm', prompt: 'secret prompt', response: 'secret' })

    const kept = collectOtlpAttributes(list, new Set(['model']))

    expect([...kept.keys()]).toEqual(['model'])
  })

  it('does not read the value of an attribute it was not asked for', () => {
    const unwanted = {
      key: 'prompt',
      get value(): never {
        throw new Error('the value was read')
      }
    }

    expect(() => collectOtlpAttributes([unwanted], new Set(['model']))).not.toThrow()
  })

  it('keeps the last value of a repeated key', () => {
    const list = [
      { key: 'model', value: { stringValue: 'first' } },
      { key: 'model', value: { stringValue: 'last' } }
    ]

    expect(collectOtlpAttributes(list, new Set(['model'])).get('model')).toEqual({
      stringValue: 'last'
    })
  })

  it('skips a malformed entry and keeps the rest', () => {
    const list = [null, 'x', { key: 7 }, { key: 'model', value: { stringValue: 'm' } }]

    expect([...collectOtlpAttributes(list, new Set(['model'])).keys()]).toEqual(['model'])
  })

  it.each([undefined, null, 'text', {}])('returns nothing for a list of %j', (list) => {
    expect(collectOtlpAttributes(list, new Set(['model'])).size).toBe(0)
  })
})

describe('readOtlpNumber', () => {
  it.each([
    ['1', 1],
    ['-2.5', -2.5],
    ['+3.', 3],
    ['.5', 0.5],
    ['1e3', 1000],
    ['1.5E-2', 0.015],
    [' 7 ', 7]
  ])('reads the decimal string %j', (text, expected) => {
    expect(readOtlpNumber({ stringValue: text })).toBe(expected)
  })

  it.each(['', ' ', '0x10', 'Infinity', 'NaN', '1,5', '1e', '--1', '.', '1.2.3', '1 2'])(
    'rejects the string %j',
    (text) => {
      expect(readOtlpNumber({ stringValue: text })).toBeUndefined()
    }
  )

  it('rejects a long run of digits that ends in a letter without backtracking', () => {
    const started = performance.now()

    const result = readOtlpNumber({ stringValue: `${'1'.repeat(30_000)}x` })

    expect(result).toBeUndefined()
    expect(performance.now() - started).toBeLessThan(250)
  })
})
