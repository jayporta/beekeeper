import { describe, expect, it } from 'vitest'
import { isLabelWithinCap, MAX_LABEL_CODE_UNITS } from '../boundedLabel'

describe('isLabelWithinCap', () => {
  it('accepts an empty string', () => {
    expect(isLabelWithinCap('')).toBe(true)
  })

  it('accepts a value of exactly the cap', () => {
    expect(isLabelWithinCap('x'.repeat(MAX_LABEL_CODE_UNITS))).toBe(true)
  })

  it('rejects a value one code unit over the cap', () => {
    expect(isLabelWithinCap('x'.repeat(MAX_LABEL_CODE_UNITS + 1))).toBe(false)
  })

  it('rejects a non-BMP value under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    const value = '😀'.repeat(200)
    expect(value.length).toBeGreaterThan(MAX_LABEL_CODE_UNITS)
    expect(isLabelWithinCap(value)).toBe(false)
  })

  it.each([[undefined], [null], [42], [{}], [['a']]])('rejects a non-string: %j', (value) => {
    expect(isLabelWithinCap(value)).toBe(false)
  })
})
