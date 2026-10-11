import { describe, expect, it } from 'vitest'
import { concatBytes } from '../concatBytes'

describe('concatBytes', () => {
  it('returns zero bytes for an empty list', () => {
    expect(concatBytes([]).length).toBe(0)
  })

  it('joins the parts in order', () => {
    const joined = concatBytes([
      Uint8Array.of(1, 2),
      new Uint8Array(0),
      Uint8Array.of(3),
      Uint8Array.of(4, 5)
    ])
    expect([...joined]).toEqual([1, 2, 3, 4, 5])
  })

  it('does not alias its inputs', () => {
    const part = Uint8Array.of(1, 2)
    const joined = concatBytes([part])
    joined[0] = 9
    expect(part[0]).toBe(1)
  })
})
