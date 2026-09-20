import { describe, expect, it } from 'vitest'
import { captureSystemError } from '../captureSystemError'

describe('captureSystemError', () => {
  it('resolves ok with the operation result on success', async () => {
    const result = await captureSystemError(async () => 42)

    expect(result).toEqual({ ok: true, value: 42 })
  })

  it('captures an error with a system error code as err', async () => {
    const error = Object.assign(new Error('permission denied'), { code: 'EACCES' })

    const result = await captureSystemError(async () => {
      throw error
    })

    expect(result).toEqual({ ok: false, error: { reason: 'unreadable', code: 'EACCES' } })
  })

  it('rethrows an error with no error code', async () => {
    await expect(
      captureSystemError(async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
  })

  it('rethrows a Node ERR_* programmer error', async () => {
    const error = Object.assign(new Error('bad arg'), { code: 'ERR_INVALID_ARG_VALUE' })

    await expect(
      captureSystemError(async () => {
        throw error
      })
    ).rejects.toBe(error)
  })
})
