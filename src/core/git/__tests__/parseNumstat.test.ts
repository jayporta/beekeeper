import { describe, expect, it } from 'vitest'
import { parseNumstat } from '../parseNumstat'

function parse(...parts: (string | Buffer)[]): ReturnType<typeof parseNumstat> {
  return parseNumstat(Buffer.concat(parts.map((part) => Buffer.from(part))))
}

describe('parseNumstat', () => {
  it('returns no entries for empty output', () => {
    expect(parse()).toEqual({ ok: true, value: [] })
  })

  it('parses normal entries', () => {
    expect(parse('3\t1\tsrc/a.ts\0', '0\t7\tb.txt\0')).toEqual({
      ok: true,
      value: [
        { path: 'src/a.ts', added: 3, deleted: 1 },
        { path: 'b.txt', added: 0, deleted: 7 }
      ]
    })
  })

  it('reports binary files with null counts', () => {
    expect(parse('-\t-\timg.png\0')).toEqual({
      ok: true,
      value: [{ path: 'img.png', added: null, deleted: null }]
    })
  })

  it('parses a rename with both paths', () => {
    expect(parse('2\t2\t\0old/name.ts\0new/name.ts\0')).toEqual({
      ok: true,
      value: [{ path: 'new/name.ts', oldPath: 'old/name.ts', added: 2, deleted: 2 }]
    })
  })

  it('keeps tabs and newlines inside a path', () => {
    expect(parse('1\t1\ta\tb\nc.txt\0')).toEqual({
      ok: true,
      value: [{ path: 'a\tb\nc.txt', added: 1, deleted: 1 }]
    })
  })

  it('decodes a path that is not valid UTF-8 with a replacement character', () => {
    const result = parse('1\t0\tbad-', Buffer.from([0xff]), '.txt\0')
    expect(result).toEqual({
      ok: true,
      value: [{ path: 'bad-�.txt', added: 1, deleted: 0 }]
    })
  })

  it('rejects a record missing its terminator', () => {
    expect(parse('1\t1\ta.ts')).toEqual({ ok: false, error: 'malformed-numstat' })
  })

  it('rejects a record with fewer than two tabs', () => {
    expect(parse('1\ta.ts\0')).toEqual({ ok: false, error: 'malformed-numstat' })
  })

  it('rejects non-numeric counts', () => {
    expect(parse('x\t1\ta.ts\0')).toEqual({ ok: false, error: 'malformed-numstat' })
  })

  it('rejects a rename missing its new path', () => {
    expect(parse('1\t1\t\0old.ts\0')).toEqual({ ok: false, error: 'malformed-numstat' })
  })
})
