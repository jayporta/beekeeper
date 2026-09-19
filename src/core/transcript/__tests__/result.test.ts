import { describe, expect, it } from 'vitest'
import { err, ok } from '../result'

describe('ok', () => {
  it('produces a successful result holding the value', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 })
  })
})

describe('err', () => {
  it('produces a failed result holding the error', () => {
    expect(err('bad-input')).toEqual({ ok: false, error: 'bad-input' })
  })
})
