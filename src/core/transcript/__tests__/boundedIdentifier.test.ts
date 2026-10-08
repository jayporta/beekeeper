import { describe, expect, it } from 'vitest'
import {
  boundedIdentifierSchema,
  isBoundedIdentifier,
  MAX_IDENTIFIER_CODE_UNITS
} from '../schemas/boundedIdentifier'

const UNPRINTABLE_IDENTIFIERS = [
  ['a bidi override', 'claude\u202Eopus'],
  ['a line separator', 'claude\u2028opus'],
  ['a control character', 'claude\u0007opus'],
  ['a lone surrogate', 'claude\uD800opus']
] as const

describe('boundedIdentifierSchema', () => {
  it('accepts a well-formed identifier', () => {
    expect(boundedIdentifierSchema.safeParse('toolu_1').success).toBe(true)
  })

  it('accepts an empty string', () => {
    expect(boundedIdentifierSchema.safeParse('').success).toBe(true)
  })

  it('accepts a value of exactly the cap', () => {
    expect(boundedIdentifierSchema.safeParse('x'.repeat(MAX_IDENTIFIER_CODE_UNITS)).success).toBe(
      true
    )
  })

  it('rejects a value one code unit over the cap', () => {
    expect(
      boundedIdentifierSchema.safeParse('x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1)).success
    ).toBe(false)
  })

  it('rejects a non-BMP value under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, so within zod's `.max()`, but
    // 400 UTF-16 code units, so over this cap.
    const value = '😀'.repeat(200)
    expect(value.length).toBeGreaterThan(MAX_IDENTIFIER_CODE_UNITS)
    expect(boundedIdentifierSchema.safeParse(value).success).toBe(false)
  })

  it.each([[undefined], [null], [42], [{}], [['a']]])('rejects a non-string: %j', (value) => {
    expect(boundedIdentifierSchema.safeParse(value).success).toBe(false)
  })

  it.each(UNPRINTABLE_IDENTIFIERS)('rejects %s', (_label, value) => {
    expect(boundedIdentifierSchema.safeParse(value).success).toBe(false)
  })

  it('accepts a well-formed character outside the Basic Multilingual Plane', () => {
    expect(boundedIdentifierSchema.safeParse('model-😀').success).toBe(true)
  })
})

describe('isBoundedIdentifier', () => {
  it.each([['toolu_1'], [''], ['model-😀'], ['x'.repeat(MAX_IDENTIFIER_CODE_UNITS)]])(
    'accepts %j',
    (value) => {
      expect(isBoundedIdentifier(value)).toBe(true)
    }
  )

  it.each(UNPRINTABLE_IDENTIFIERS)('rejects %s', (_label, value) => {
    expect(isBoundedIdentifier(value)).toBe(false)
  })

  it('rejects a value over the cap', () => {
    expect(isBoundedIdentifier('x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1))).toBe(false)
  })

  it.each([[undefined], [null], [42], [{}]])('rejects a non-string: %j', (value) => {
    expect(isBoundedIdentifier(value)).toBe(false)
  })
})
