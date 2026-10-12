import { describe, expect, it } from 'vitest'
import { errorCode } from '../../../core/shared/errorCode'
import { isMissingEntryError } from '../../../core/shared/isMissingEntryError'
import { toPortError } from '../toPortError'

describe('toPortError', () => {
  it('keeps the code an error carries', () => {
    const original = Object.assign(new Error('boom at /secret/path'), { code: 'EACCES' })

    expect(errorCode(toPortError(original))).toBe('EACCES')
  })

  it('reads the code out of the message when the error has none', () => {
    const original = new Error("ENOENT: no such file or directory, open '/secret/path'")

    const converted = toPortError(original)

    expect(errorCode(converted)).toBe('ENOENT')
    expect(isMissingEntryError(converted)).toBe(true)
  })

  it('falls back to EIO when there is no code anywhere', () => {
    expect(errorCode(toPortError(new Error('something at /secret/path')))).toBe('EIO')
  })

  it('falls back to EIO for a value that is not an error', () => {
    expect(errorCode(toPortError('/secret/path'))).toBe('EIO')
  })

  it('carries the code alone: no engine text, no cause', () => {
    const original = Object.assign(new Error('boom at /secret/path'), { code: 'EACCES' })

    const converted = toPortError(original)

    expect(converted.message).toBe('EACCES')
    expect(converted.cause).toBeUndefined()
    expect(converted.stack ?? '').not.toContain('/secret/path')
  })
})
