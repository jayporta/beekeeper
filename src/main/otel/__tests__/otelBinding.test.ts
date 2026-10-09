import { describe, expect, it } from 'vitest'
import { OTEL_PORT_MAX, OTEL_PORT_MIN, randomOtelPort, randomOtelToken } from '../otelBinding'

describe('randomOtelPort', () => {
  it('stays inside the pool, clear of the ephemeral and NodePort ranges', () => {
    const ports = Array.from({ length: 2000 }, () => randomOtelPort())

    expect([Math.min(...ports) >= OTEL_PORT_MIN, Math.max(...ports) <= OTEL_PORT_MAX]).toEqual([
      true,
      true
    ])
    expect([OTEL_PORT_MIN, OTEL_PORT_MAX]).toEqual([20000, 29999])
  })

  it('does not return the same port every time', () => {
    expect(new Set(Array.from({ length: 50 }, () => randomOtelPort())).size).toBeGreaterThan(1)
  })
})

describe('randomOtelToken', () => {
  it('is 32 random bytes as base64url', () => {
    expect(randomOtelToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('differs on every call', () => {
    expect(randomOtelToken()).not.toBe(randomOtelToken())
  })
})
