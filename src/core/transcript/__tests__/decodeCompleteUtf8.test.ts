import { describe, expect, it } from 'vitest'
import { splitCompleteUtf8 } from '../decodeCompleteUtf8'

function split(...bytes: number[]): { complete: number[]; rest: number[] } {
  const result = splitCompleteUtf8(Uint8Array.from(bytes))
  return { complete: [...result.complete], rest: [...result.rest] }
}

describe('splitCompleteUtf8', () => {
  it('keeps plain ASCII whole with nothing carried', () => {
    expect(split(0x61, 0x62, 0x63)).toEqual({ complete: [0x61, 0x62, 0x63], rest: [] })
  })

  it('returns an empty split for no bytes', () => {
    expect(split()).toEqual({ complete: [], rest: [] })
  })

  it('carries two of the three bytes of a euro sign', () => {
    expect(split(0x61, 0xe2, 0x82)).toEqual({ complete: [0x61], rest: [0xe2, 0x82] })
  })

  it('carries nothing when the euro sign is complete', () => {
    expect(split(0x61, 0xe2, 0x82, 0xac)).toEqual({
      complete: [0x61, 0xe2, 0x82, 0xac],
      rest: []
    })
  })

  it('carries a lone four-byte lead byte', () => {
    expect(split(0x61, 0xf0)).toEqual({ complete: [0x61], rest: [0xf0] })
  })

  it('carries a two-byte lead byte with no continuation', () => {
    expect(split(0xc3)).toEqual({ complete: [], rest: [0xc3] })
  })

  it('leaves a lead byte followed by ASCII whole, to decode as a replacement character', () => {
    expect(split(0xe2, 0x41)).toEqual({ complete: [0xe2, 0x41], rest: [] })
  })

  it('leaves a lone continuation byte whole', () => {
    expect(split(0x80)).toEqual({ complete: [0x80], rest: [] })
  })

  it('never carries a newline after a lead byte', () => {
    expect(split(0xe2, 0x0a)).toEqual({ complete: [0xe2, 0x0a], rest: [] })
  })

  it('leaves a complete three-byte character before a trailing lead byte carried alone', () => {
    expect(split(0xe2, 0x82, 0xac, 0xe2)).toEqual({
      complete: [0xe2, 0x82, 0xac],
      rest: [0xe2]
    })
  })
})
