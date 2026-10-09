import { describe, expect, it } from 'vitest'
import { commandHash } from '../commandHash'

describe('commandHash', () => {
  it('gives the same hash for the same string', () => {
    expect(commandHash('npm test')).toBe(commandHash('npm test'))
  })

  it('gives different hashes for strings that differ by a trailing space', () => {
    expect(commandHash('ls')).not.toBe(commandHash('ls '))
  })

  it('gives a non-negative integer below 2^32', () => {
    const hash = commandHash('echo "héllo 👋"')
    expect(Number.isInteger(hash)).toBe(true)
    expect(hash).toBeGreaterThanOrEqual(0)
    expect(hash).toBeLessThan(2 ** 32)
  })
})
