import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonlLines, type ReadJsonlLinesOptions } from '../readJsonlLines'

/** The mod's runtime ignores `{ stream: true }`, so decoding must never rely on it. */
class NoStreamTextDecoder extends TextDecoder {
  override decode(input?: AllowSharedBufferSource, options?: TextDecodeOptions): string {
    if (options?.stream === true) throw new Error('stream decoding is not available')
    return super.decode(input, options)
  }
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-jsonl-nostream-'))
  vi.stubGlobal('TextDecoder', NoStreamTextDecoder)
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

async function readLines(content: string, options?: ReadJsonlLinesOptions): Promise<string[]> {
  const filePath = join(dir, 'fixture.jsonl')
  writeFileSync(filePath, content, 'utf-8')
  const lines: string[] = []
  for await (const result of readJsonlLines(filePath, options)) {
    if (!result.ok) throw new Error('Expected only ok results')
    lines.push(result.value)
  }
  return lines
}

const CHUNK_SIZES = [1, 2, undefined] as const

describe('readJsonlLines without stream decoding', () => {
  it.each([1, 2])('reassembles a euro sign split across %i-byte chunks', async (highWaterMark) => {
    const lines = await readLines('{"a":"€x€"}\nnext\n', { highWaterMark })

    expect(lines).toEqual(['{"a":"€x€"}', 'next'])
  })

  it.each(CHUNK_SIZES)(
    'drops a byte order mark at the start of the file (chunks %s)',
    async (highWaterMark) => {
      const lines = await readLines('\uFEFF{"a":1}\n{"b":2}\n', { highWaterMark })

      expect(lines).toEqual(['{"a":1}', '{"b":2}'])
    }
  )

  it.each(CHUNK_SIZES)(
    'keeps a byte order mark at a resumed offset (chunks %s)',
    async (highWaterMark) => {
      const first = '{"a":1}\n'

      const lines = await readLines(`${first}\uFEFF{"b":2}\n`, {
        highWaterMark,
        start: Buffer.byteLength(first)
      })

      expect(lines).toEqual(['\uFEFF{"b":2}'])
    }
  )

  it.each(CHUNK_SIZES)(
    'keeps a byte order mark that begins a later line (chunks %s)',
    async (highWaterMark) => {
      const lines = await readLines('\uFEFF{"a":1}\n\uFEFF{"b":2}\n', { highWaterMark })

      expect(lines).toEqual(['{"a":1}', '\uFEFF{"b":2}'])
    }
  )

  it('reports the byte offset past each newline when a multi-byte character straddles chunks', async () => {
    const filePath = join(dir, 'cursor.jsonl')
    const content = '€€\nab\n'
    writeFileSync(filePath, content, 'utf-8')
    const cursor = { offset: 0 }
    const offsets: number[] = []

    for await (const result of readJsonlLines(filePath, { highWaterMark: 2, cursor })) {
      expect(result.ok).toBe(true)
      offsets.push(cursor.offset)
    }

    expect(offsets).toEqual([Buffer.byteLength('€€\n'), Buffer.byteLength(content)])
  })
})
