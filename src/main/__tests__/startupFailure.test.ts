import { describe, expect, it } from 'vitest'
import { isFatalLoadFailure } from '../startupFailure'

function withCode(code: string): Error {
  return Object.assign(new Error('failed loading file:///Users/someone/app/index.html'), { code })
}

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
