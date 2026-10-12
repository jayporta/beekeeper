import { describe, expect, it } from 'vitest'
import {
  boundedIdentifierSchema,
  isBoundedIdentifier,
  MAX_IDENTIFIER_CODE_UNITS
} from '../schemas/boundedIdentifier'

/** The classes of unprintable character are covered in hasUnprintable.test.ts. */
const UNPRINTABLE_IDENTIFIER = 'claude\u202Eopus'

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

  it('rejects a non-string', () => {
    expect(boundedIdentifierSchema.safeParse(42).success).toBe(false)
  })

  it('rejects an unprintable identifier', () => {
    expect(boundedIdentifierSchema.safeParse(UNPRINTABLE_IDENTIFIER).success).toBe(false)
  })

  it('accepts a well-formed character outside the Basic Multilingual Plane', () => {
    expect(boundedIdentifierSchema.safeParse('model-😀').success).toBe(true)
  })
})

describe('isBoundedIdentifier', () => {
  it('accepts a value of exactly the cap', () => {
    expect(isBoundedIdentifier('x'.repeat(MAX_IDENTIFIER_CODE_UNITS))).toBe(true)
  })

  it('rejects an unprintable identifier', () => {
    expect(isBoundedIdentifier(UNPRINTABLE_IDENTIFIER)).toBe(false)
  })

  it('rejects a value over the cap', () => {
    expect(isBoundedIdentifier('x'.repeat(MAX_IDENTIFIER_CODE_UNITS + 1))).toBe(false)
  })

  it('rejects a non-string', () => {
    expect(isBoundedIdentifier(['a'])).toBe(false)
  })
})
