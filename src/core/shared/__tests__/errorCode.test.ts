import { describe, expect, it } from 'vitest'
import { errorCode } from '../errorCode'

describe('errorCode', () => {
  it('returns the code of an error-like object', () => {
    expect(errorCode({ code: 'ENOENT' })).toBe('ENOENT')
  })

  it('returns undefined when there is no code property', () => {
    expect(errorCode(new Error('boom'))).toBeUndefined()
  })

  it('returns undefined when code is not a string', () => {
    expect(errorCode({ code: 42 })).toBeUndefined()
  })

  it('returns undefined for a non-object error', () => {
    expect(errorCode('boom')).toBeUndefined()
    expect(errorCode(undefined)).toBeUndefined()
    expect(errorCode(null)).toBeUndefined()
  })
})
