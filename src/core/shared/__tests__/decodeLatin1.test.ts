import { describe, expect, it } from 'vitest'
import { decodeLatin1 } from '../decodeLatin1'

describe('decodeLatin1', () => {
  it('maps every byte value like Buffer does', () => {
    const all = Uint8Array.from({ length: 256 }, (_, index) => index)
    expect(decodeLatin1(all)).toBe(Buffer.from(all).toString('latin1'))
  })

  it('maps bytes 0x80 to 0x9F to the same char codes, not windows-1252', () => {
    const bytes = Uint8Array.from({ length: 0x20 }, (_, index) => 0x80 + index)
    const codes = [...decodeLatin1(bytes)].map((char) => char.charCodeAt(0))
    expect(codes).toEqual(Array.from({ length: 0x20 }, (_, index) => 0x80 + index))
  })

  it('decodes an empty input to an empty string', () => {
    expect(decodeLatin1(new Uint8Array(0))).toBe('')
  })

  it('decodes a 100 000-byte input without overflowing the stack', () => {
    const text = decodeLatin1(new Uint8Array(100_000).fill(0x41))
    expect(text).toHaveLength(100_000)
    expect(text.startsWith('AAA')).toBe(true)
  })
})
