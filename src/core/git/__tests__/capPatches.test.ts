import { describe, expect, it } from 'vitest'
import { capPatches } from '../capPatches'
import type { PatchFile } from '../parseDiffPatch'

const file = (path: string, patch: string | Buffer): PatchFile => ({
  path,
  patch: Buffer.from(patch)
})
const limits = { perFile: 100, total: 250 }

describe('capPatches', () => {
  it('keeps a patch that fits whole, as text', () => {
    const result = capPatches([file('a.txt', 'diff\n+x\n')], limits)

    expect(result).toEqual({
      files: [{ path: 'a.txt', patch: 'diff\n+x\n', truncated: false }],
      truncatedTotal: false
    })
  })

  it('keeps a rename’s old path', () => {
    const renamed: PatchFile = { path: 'b', oldPath: 'a', patch: Buffer.from('x') }

    expect(capPatches([renamed], limits).files[0]).toMatchObject({ path: 'b', oldPath: 'a' })
  })

  it('cuts a patch over the per-file cap at its last whole line, and marks it', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `+line ${String(i).padStart(2, '0')}\n`)

    const { files, truncatedTotal } = capPatches([file('big.txt', lines.join(''))], limits)

    const kept = files[0]?.patch ?? ''
    expect(files[0]?.truncated).toBe(true)
    expect(Buffer.byteLength(kept)).toBeLessThanOrEqual(limits.perFile)
    expect(kept).toBe(lines.slice(0, kept.split('\n').length - 1).join(''))
    expect(kept.length).toBeGreaterThan(0)
    expect(truncatedTotal).toBe(false)
  })

  it('does not split a character when a cut line has no newline to stop at', () => {
    const text = 'é'.repeat(100)

    // 101 bytes ends in the first byte of a two-byte character.
    const { files } = capPatches([file('wide.txt', text)], { ...limits, perFile: 101 })

    expect(files[0]?.truncated).toBe(true)
    expect(files[0]?.patch).not.toContain('�')
    expect(files[0]?.patch).toBe('é'.repeat(50))
  })

  it('keeps a patch of exactly the cap whole', () => {
    const { files } = capPatches([file('exact.txt', 'x'.repeat(100))], limits)

    expect(files[0]).toMatchObject({ truncated: false })
    expect(files[0]?.patch).toHaveLength(100)
  })

  it('cuts at the total cap, marking the file that crossed it and the whole result', () => {
    const files = [
      file('a', 'a'.repeat(100)),
      file('b', 'b'.repeat(100)),
      file('c', 'c'.repeat(100))
    ]

    const result = capPatches(files, limits)

    expect(result.files.map((f) => [f.path, f.patch.length, f.truncated])).toEqual([
      ['a', 100, false],
      ['b', 100, false],
      ['c', 50, true]
    ])
    expect(result.truncatedTotal).toBe(true)
  })

  it('lists the files after the total cap with no patch, each marked truncated', () => {
    const files = [
      file('a', 'a'.repeat(100)),
      file('b', 'b'.repeat(100)),
      file('c', 'c'.repeat(50)),
      file('d', 'd'.repeat(10)),
      file('e', 'e'.repeat(10))
    ]

    const result = capPatches(files, limits)

    expect(result.files.map((f) => [f.path, f.patch.length, f.truncated])).toEqual([
      ['a', 100, false],
      ['b', 100, false],
      ['c', 50, false],
      ['d', 0, true],
      ['e', 0, true]
    ])
    expect(result.truncatedTotal).toBe(true)
  })

  it('does not mark the total as truncated when the files end exactly at the cap', () => {
    const files = [
      file('a', 'a'.repeat(100)),
      file('b', 'b'.repeat(100)),
      file('c', 'c'.repeat(50))
    ]

    expect(capPatches(files, limits).truncatedTotal).toBe(false)
  })

  it('counts only what a cut file kept against the total', () => {
    const big = file('big', `${'+x\n'.repeat(60)}`)
    const next = file('next', 'n'.repeat(100))

    const result = capPatches([big, next], limits)

    const kept = result.files[0]?.patch.length ?? 0
    expect(kept).toBeLessThan(100)
    expect(result.files[1]?.patch).toHaveLength(100)
    expect(result.truncatedTotal).toBe(false)
  })

  it('decodes bytes that are not valid UTF-8 with replacement characters', () => {
    const { files } = capPatches([file('a', Buffer.from([0x2b, 0xff, 0x0a]))], limits)

    expect(files[0]?.patch).toBe('+�\n')
  })

  it('does not call a cut by the per-file cap a total cut when both caps coincide', () => {
    const result = capPatches([file('a', 'a'.repeat(100)), file('b', 'b'.repeat(150))], {
      perFile: 100,
      total: 200
    })

    expect(result.files[1]).toMatchObject({ truncated: true })
    expect(result.truncatedTotal).toBe(false)
  })

  it('gives the next file what a cut file left of the total, not what it was allowed', () => {
    const big = file('big', '+x\n'.repeat(60))
    const exact = file('next', 'n'.repeat(31))

    const result = capPatches([big, exact], { perFile: 100, total: 130 })

    expect(result.files[0]?.patch).toHaveLength(99)
    expect(result.files[1]).toMatchObject({ truncated: false })
    expect(result.files[1]?.patch).toHaveLength(31)
  })

  it('counts the raw bytes a cut file kept against the total, even when they are not valid UTF-8', () => {
    // Each 0xe9 byte decodes to a three-byte replacement character, so a
    // string's size would overstate the 30 bytes the file kept.
    const latin1 = Buffer.concat(
      Array.from({ length: 10 }, () => Buffer.from([0x2b, ...Array(8).fill(0xe9), 0x0a]))
    )

    const { files } = capPatches([file('a', latin1), file('b', latin1)], { perFile: 30, total: 30 })

    expect(files[0]).toMatchObject({ truncated: true })
    expect(files[1]).toMatchObject({ patch: '', truncated: true })
  })

  it('uses roughly 200 KB per file and 2 MB in all by default', () => {
    const one = capPatches([file('a', 'x\n'.repeat(500_000))])
    const many = capPatches(
      Array.from({ length: 20 }, (_, i) => file(`f${i}`, 'x'.repeat(150_000)))
    )

    expect(Buffer.byteLength(one.files[0]?.patch ?? '')).toBeLessThanOrEqual(200 * 1024)
    expect(one.files[0]?.truncated).toBe(true)
    const total = many.files.reduce((sum, f) => sum + Buffer.byteLength(f.patch), 0)
    expect(total).toBeLessThanOrEqual(2 * 1024 * 1024)
    expect(many.truncatedTotal).toBe(true)
  })
})
