import { describe, expect, it } from 'vitest'
import { indexOfBytes } from '../indexOfBytes'

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text)
const expected = (haystack: string, needle: string, from?: number): number =>
  Buffer.from(haystack).indexOf(Buffer.from(needle), from)

describe('indexOfBytes', () => {
  it.each([
    ['at the start', 'abcdef', 'abc', undefined],
    ['in the middle', 'xxabcxx', 'abc', undefined],
    ['at the end', 'xxabc', 'abc', undefined],
    ['not at all', 'abcdef', 'xyz', undefined],
    ['after a match when from is past it', 'abcabc', 'abc', 1],
    ['when the needle is longer than the haystack', 'ab', 'abc', undefined],
    ['when only a prefix of the needle ends the haystack', 'xxab', 'abc', undefined],
    ['with a repeating prefix in the haystack', 'aababc', 'aabc', undefined]
  ])('finds the needle %s like Buffer does', (_name, haystack, needle, from) => {
    expect(indexOfBytes(bytes(haystack), bytes(needle), from)).toBe(
      expected(haystack, needle, from)
    )
  })

  it('finds a needle that straddles the midpoint of a large haystack', () => {
    const haystack = new Uint8Array(100_000).fill(0x61)
    haystack.set(bytes('\ndiff --git '), 49_995)
    expect(indexOfBytes(haystack, bytes('\ndiff --git '))).toBe(49_995)
  })

  it('returns -1 when from is past the end', () => {
    expect(indexOfBytes(bytes('abc'), bytes('a'), 10)).toBe(-1)
  })
})
