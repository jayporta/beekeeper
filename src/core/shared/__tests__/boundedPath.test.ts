import { describe, expect, it } from 'vitest'
import { isAbsolutePathWithinCap, isPathWithinCap, MAX_PATH_CODE_UNITS } from '../boundedPath'

describe('isPathWithinCap', () => {
  it('accepts an empty string', () => {
    expect(isPathWithinCap('')).toBe(true)
  })

  it('accepts a value of exactly the cap', () => {
    expect(isPathWithinCap('a'.repeat(MAX_PATH_CODE_UNITS))).toBe(true)
  })

  it('rejects a value one code unit over the cap', () => {
    expect(isPathWithinCap('a'.repeat(MAX_PATH_CODE_UNITS + 1))).toBe(false)
  })

  it('rejects a non-BMP value under the code-point cap but over the code-unit cap', () => {
    // 3000 non-BMP characters: 3000 code points, but 6000 UTF-16 code units.
    const value = '😀'.repeat(3000)
    expect(value.length).toBeGreaterThan(MAX_PATH_CODE_UNITS)
    expect(isPathWithinCap(value)).toBe(false)
  })

  it.each([[undefined], [null], [42], [{}], [['a']]])('rejects a non-string: %j', (value) => {
    expect(isPathWithinCap(value)).toBe(false)
  })
})

describe('isAbsolutePathWithinCap', () => {
  it('accepts an absolute path within the cap', () => {
    expect(isAbsolutePathWithinCap('/repo/src')).toBe(true)
  })

  it('rejects a relative path', () => {
    expect(isAbsolutePathWithinCap('repo/src')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isAbsolutePathWithinCap('')).toBe(false)
  })

  it('accepts an absolute path of exactly the cap', () => {
    expect(isAbsolutePathWithinCap(`/${'a'.repeat(MAX_PATH_CODE_UNITS - 1)}`)).toBe(true)
  })

  it('rejects an absolute path one code unit over the cap', () => {
    expect(isAbsolutePathWithinCap(`/${'a'.repeat(MAX_PATH_CODE_UNITS)}`)).toBe(false)
  })

  it('rejects a non-BMP absolute path under the code-point cap but over the code-unit cap', () => {
    expect(isAbsolutePathWithinCap(`/${'😀'.repeat(3000)}`)).toBe(false)
  })

  it.each([[undefined], [null], [42], [{}], [['a']]])('rejects a non-string: %j', (value) => {
    expect(isAbsolutePathWithinCap(value)).toBe(false)
  })
})
