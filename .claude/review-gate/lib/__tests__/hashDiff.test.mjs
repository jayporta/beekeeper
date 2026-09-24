import { describe, expect, it } from 'vitest'
import { hashDiff } from '../reviewScope.mjs'

describe('hashDiff', () => {
  it('matches the known sha256 of "abc"', () => {
    expect(hashDiff('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('hashes a Buffer the same way as the equivalent string', () => {
    expect(hashDiff(Buffer.from('abc', 'utf8'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )
  })

  it('matches the known sha256 of the empty string', () => {
    expect(hashDiff('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
