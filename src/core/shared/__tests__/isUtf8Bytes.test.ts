import { isUtf8 } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import { isUtf8Bytes } from '../isUtf8Bytes'

const CASES: readonly (readonly [string, readonly number[]])[] = [
  ['ASCII', [0x61, 0x62]],
  ['multi-byte text', [...new TextEncoder().encode('é€😀')]],
  ['empty input', []],
  ['a byte order mark alone', [0xef, 0xbb, 0xbf]],
  ['a lone 0xFF', [0x61, 0xff]],
  ['a lone continuation byte', [0x80]],
  ['an overlong sequence', [0xc0, 0xaf]],
  ['a 4-byte sequence cut after 2 bytes', [0x61, 0xf0, 0x9f]]
]

describe('isUtf8Bytes', () => {
  it.each(CASES)('agrees with node:buffer isUtf8 for %s', (_name, bytes) => {
    expect(isUtf8Bytes(new Uint8Array(bytes))).toBe(isUtf8(Buffer.from(bytes)))
  })

  it('accepts valid text', () => {
    expect(isUtf8Bytes(new TextEncoder().encode('é€😀'))).toBe(true)
  })

  it('rejects a truncated multi-byte sequence', () => {
    expect(isUtf8Bytes(new Uint8Array([0x61, 0xf0, 0x9f]))).toBe(false)
  })

  it('accepts a byte order mark alone', () => {
    expect(isUtf8Bytes(new Uint8Array([0xef, 0xbb, 0xbf]))).toBe(true)
  })
})
