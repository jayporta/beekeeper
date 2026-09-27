import { describe, expect, it } from 'vitest'
import { describeError, isFatalLoadFailure } from '../startupFailure'

function withCode(code: string): Error {
  return Object.assign(new Error('failed loading file:///Users/someone/app/index.html'), { code })
}

describe('describeError', () => {
  it('names an error by its code', () => {
    expect(describeError(withCode('ERR_FILE_NOT_FOUND'))).toBe('ERR_FILE_NOT_FOUND')
  })

  it('names a codeless error by its class, never its message', () => {
    const described = describeError(new TypeError('/Users/someone/secret/path'))

    expect(described).toBe('TypeError')
  })

  it('names a thrown non-error as unknown', () => {
    expect(describeError('/Users/someone/secret/path')).toBe('unknown error')
  })
})

describe('isFatalLoadFailure', () => {
  it('ignores an aborted load while a newer navigation is loading', () => {
    expect(isFatalLoadFailure(withCode('ERR_ABORTED'), true)).toBe(false)
  })

  it('treats an aborted load with nothing replacing it as fatal', () => {
    expect(isFatalLoadFailure(withCode('ERR_ABORTED'), false)).toBe(true)
  })

  it('treats any other failure as fatal even while loading', () => {
    expect(isFatalLoadFailure(withCode('ERR_FILE_NOT_FOUND'), true)).toBe(true)
  })

  it('treats a codeless rejection as fatal', () => {
    expect(isFatalLoadFailure(new Error('boom'), true)).toBe(true)
  })
})
