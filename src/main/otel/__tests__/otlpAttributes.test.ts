import { describe, expect, it } from 'vitest'
import { collectOtlpAttributes } from '../otlpAttributes'
import { otlpAttributes } from '../testOtlpLogs'

describe('collectOtlpAttributes', () => {
  it('keeps only the wanted keys', () => {
    const list = otlpAttributes({ model: 'm', prompt: 'secret prompt', response: 'secret' })

    const kept = collectOtlpAttributes(list, new Set(['model']))

    expect([...kept.keys()]).toEqual(['model'])
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
