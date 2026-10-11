import { describe, expect, it } from 'vitest'
import { utf8ByteLength } from '../utf8ByteLength'

describe('utf8ByteLength', () => {
  it.each([
    ['ASCII', 'abc'],
    ['a 2-byte character', 'é'],
    ['a 3-byte character', '€'],
    ['a 4-byte character', '😀'],
    ['a lone surrogate', '\uD800'],
    ['an empty string', '']
  ])('counts %s like Buffer.byteLength', (_name, text) => {
    expect(utf8ByteLength(text)).toBe(Buffer.byteLength(text))
  })
})
