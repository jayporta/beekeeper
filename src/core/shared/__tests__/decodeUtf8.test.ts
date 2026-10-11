import { describe, expect, it } from 'vitest'
import { decodeUtf8 } from '../decodeUtf8'

const asBuffer = (bytes: readonly number[]): string => Buffer.from(bytes).toString('utf-8')
const decode = (bytes: readonly number[]): string => decodeUtf8(new Uint8Array(bytes))

describe('decodeUtf8', () => {
  it('decodes ASCII and multi-byte text', () => {
    const bytes = new TextEncoder().encode('héllo €😀')
    expect(decodeUtf8(bytes)).toBe('héllo €😀')
  })

  it('keeps a leading byte order mark as U+FEFF', () => {
    const bytes = [0xef, 0xbb, 0xbf, 0x61]
    expect(decode(bytes)).toBe('﻿a')
    expect(decode(bytes)).toBe(asBuffer(bytes))
  })

  it.each([
    ['a lone 0xFF', [0x61, 0xff, 0x62]],
    ['a lone continuation byte', [0x61, 0x80, 0x62]],
    ['an overlong sequence', [0xc0, 0xaf]],
    ['a 4-byte sequence cut after 2 bytes', [0x61, 0xf0, 0x9f]]
  ])('replaces %s like Buffer does', (_name, bytes) => {
    expect(decode(bytes)).toBe(asBuffer(bytes))
  })

  it('decodes an empty input to an empty string', () => {
    expect(decode([])).toBe('')
  })
})
