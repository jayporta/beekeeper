import { describe, expect, it } from 'vitest'
import { boundedIdentifierSchema, MAX_IDENTIFIER_CODE_UNITS } from '../schemas/boundedIdentifier'

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
})
