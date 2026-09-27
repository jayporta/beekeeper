import { describe, expect, it } from 'vitest'
import { isAbsolutePath } from '../absolutePath'

describe('isAbsolutePath', () => {
  it('accepts an absolute path', () => {
    expect(isAbsolutePath('/repo/src')).toBe(true)
  })

  it('rejects a relative path', () => {
    expect(isAbsolutePath('repo/src')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isAbsolutePath('')).toBe(false)
  })

  it('rejects a Windows-style absolute path', () => {
    expect(isAbsolutePath('C:\\repo\\src')).toBe(false)
  })
})
