import { describe, expect, it } from 'vitest'
import { isMissingEntryError } from '../isMissingEntryError'

describe('isMissingEntryError', () => {
  it('returns true for an ENOENT error', () => {
    expect(isMissingEntryError({ code: 'ENOENT' })).toBe(true)
  })

  it('returns true for an ENOTDIR error', () => {
    expect(isMissingEntryError({ code: 'ENOTDIR' })).toBe(true)
  })

  it('returns false for an unrelated error code', () => {
    expect(isMissingEntryError({ code: 'EACCES' })).toBe(false)
  })

  it('returns false for an object with no code property', () => {
    expect(isMissingEntryError(new Error('boom'))).toBe(false)
  })

  it('returns false for a non-object error', () => {
    expect(isMissingEntryError('boom')).toBe(false)
    expect(isMissingEntryError(undefined)).toBe(false)
    expect(isMissingEntryError(null)).toBe(false)
  })
})
