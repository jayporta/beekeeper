import { describe, expect, it } from 'vitest'
import { IpcCallError } from '../ipcCallError'
import { unwrapIpcResult } from '../unwrapIpcResult'

describe('unwrapIpcResult', () => {
  it('returns the value of a successful result', () => {
    expect(unwrapIpcResult({ ok: true, value: [1, 2] })).toEqual([1, 2])
  })

  it('throws an IpcCallError carrying the code of a failed result', () => {
    const failed = { ok: false, error: { code: 'unreadable' } } as const

    expect(() => unwrapIpcResult(failed)).toThrow(IpcCallError)
    expect(() => unwrapIpcResult(failed)).toThrow('unreadable')
  })
})

describe('IpcCallError.codeOf', () => {
  it('reads the code from an IpcCallError', () => {
    expect(IpcCallError.codeOf(new IpcCallError('not-found'))).toBe('not-found')
  })

  it('reports internal for any other value', () => {
    expect(IpcCallError.codeOf(new Error('boom'))).toBe('internal')
    expect(IpcCallError.codeOf('unreadable')).toBe('internal')
  })
})
