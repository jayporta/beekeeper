import { describe, expect, it } from 'vitest'
import { describeError } from '../describeError'
import { errorWithCode } from '../testErrorWithCode'

describe('describeError', () => {
  it('names an error by its code', () => {
    expect(describeError(errorWithCode('ERR_FILE_NOT_FOUND'))).toBe('ERR_FILE_NOT_FOUND')
  })

  it('names an error by its class when its code is not a plain constant', () => {
    const described = describeError(errorWithCode('/Users/someone/secret\nforged line'))

    expect(described).toBe('Error')
  })

  it('names a codeless error by its class, never its message', () => {
    const described = describeError(new TypeError('/Users/someone/secret/path'))

    expect(described).toBe('TypeError')
  })

  it('names a thrown non-error as unknown', () => {
    expect(describeError('/Users/someone/secret/path')).toBe('unknown error')
  })
})
