import { describe, expect, it } from 'vitest'
import { requestIdKey } from '../requestIdKey'

describe('requestIdKey', () => {
  it('gives the same key for the same id', () => {
    expect(requestIdKey('req_abc')).toBe(requestIdKey('req_abc'))
  })

  it('gives different keys for different ids', () => {
    expect(requestIdKey('req_abc')).not.toBe(requestIdKey('req_abd'))
  })

  it('gives a non-negative integer that fits exactly in a number', () => {
    const key = requestIdKey('req_abc')

    expect(Number.isSafeInteger(key) && key >= 0).toBe(true)
  })

  it('uses all 52 bits, so some keys are above 2^48 and all are below 2^52', () => {
    const keys = Array.from({ length: 1000 }, (_, i) => requestIdKey(`req_${i}`))

    expect(keys.some((key) => key >= 2 ** 48)).toBe(true)
    expect(keys.every((key) => key < 2 ** 52)).toBe(true)
  })

  it('gives distinct keys for ten thousand ids', () => {
    const keys = new Set(Array.from({ length: 10_000 }, (_, i) => requestIdKey(`req_${i}`)))

    expect(keys.size).toBe(10_000)
  })
})
