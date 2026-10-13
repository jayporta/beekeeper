import { describe, expect, it } from 'vitest'
import { isBranchNameWithinCap, MAX_BRANCH_CODE_UNITS } from '../boundedBranch'

describe('isBranchNameWithinCap', () => {
  it('accepts an ordinary branch name', () => {
    expect(isBranchNameWithinCap('feat/example')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isBranchNameWithinCap('')).toBe(false)
  })

  it('accepts a value of exactly the cap', () => {
    expect(isBranchNameWithinCap('a'.repeat(MAX_BRANCH_CODE_UNITS))).toBe(true)
  })

  it('rejects a value one code unit over the cap', () => {
    expect(isBranchNameWithinCap('a'.repeat(MAX_BRANCH_CODE_UNITS + 1))).toBe(false)
  })

  it('rejects a non-BMP value under the code-point cap but over the code-unit cap', () => {
    // 200 non-BMP characters: 200 code points, but 400 UTF-16 code units.
    const value = '😀'.repeat(200)
    expect(value.length).toBeGreaterThan(MAX_BRANCH_CODE_UNITS)
    expect(isBranchNameWithinCap(value)).toBe(false)
  })

  it.each([[undefined], [null], [42], [{}], [['a']]])('rejects a non-string: %j', (value) => {
    expect(isBranchNameWithinCap(value)).toBe(false)
  })
})
