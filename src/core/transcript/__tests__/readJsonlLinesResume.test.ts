import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJsonlLines, type ReadCursor, type ReadJsonlLinesOptions } from '../readJsonlLines'
import { MULTIBYTE_TEXT } from '../testFixtures'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-transcript-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeFixture(content: string): string {
  const filePath = join(dir, 'session.jsonl')
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

/** The lines a read yields (an oversized line as `null`) and where its cursor ended. */
async function readWithCursor(
  filePath: string,
  options: ReadJsonlLinesOptions = {}
): Promise<{ lines: Array<string | null>; offset: number }> {
  const cursor: ReadCursor = { offset: -1 }
  const lines: Array<string | null> = []
  for await (const result of readJsonlLines(filePath, { ...options, cursor })) {
    lines.push(result.ok ? result.value : null)
  }
  return { lines, offset: cursor.offset }
}

const byteLength = (text: string): number => Buffer.byteLength(text, 'utf-8')

/**
 * Chunk sizes from one byte up, so a boundary lands inside a character and on
 * a terminator, plus one that holds every fixture whole.
 */
const CHUNK_SIZES = [1, 2, 3, 4, 5, 6, 7, 64]

describe('readJsonlLines cursor', () => {
  it.each(CHUNK_SIZES)(
    'ends just past the last newline whatever the chunk size (highWaterMark %i)',
    async (highWaterMark) => {
      const complete = `${MULTIBYTE_TEXT}\n€€\n{"b":2}\n`
      const filePath = writeFixture(`${complete}{"c":3, incompl`)

      const { lines, offset } = await readWithCursor(filePath, { highWaterMark })

      expect(lines).toEqual([MULTIBYTE_TEXT, '€€', '{"b":2}'])
      expect(offset).toBe(byteLength(complete))
    }
  )

  it.each(CHUNK_SIZES)(
    'counts a CRLF terminator as two bytes (highWaterMark %i)',
    async (highWaterMark) => {
      const filePath = writeFixture('{"a":1}\r\n{"a":2}\r\n')

      const { lines, offset } = await readWithCursor(filePath, { highWaterMark })

      expect(lines).toEqual(['{"a":1}', '{"a":2}'])
      expect(offset).toBe(byteLength('{"a":1}\r\n{"a":2}\r\n'))
    }
  )

  it('advances past blank lines it skips', async () => {
    const filePath = writeFixture('{"a":1}\n\n\n')

    const { lines, offset } = await readWithCursor(filePath)

    expect(lines).toEqual(['{"a":1}'])
    expect(offset).toBe(byteLength('{"a":1}\n\n\n'))
  })

  it('advances past an oversized line once its terminator arrives', async () => {
    const content = `${'x'.repeat(50)}\nshort\n`
    const filePath = writeFixture(content)

    const { lines, offset } = await readWithCursor(filePath, { highWaterMark: 8, maxLineChars: 20 })

    expect(lines).toEqual([null, 'short'])
    expect(offset).toBe(byteLength(content))
  })

  it('stays at the start of an oversized line that has no terminator yet', async () => {
    const complete = '{"a":1}\n'
    const filePath = writeFixture(`${complete}${'x'.repeat(50)}`)

    const { lines, offset } = await readWithCursor(filePath, { highWaterMark: 8, maxLineChars: 20 })

    expect(lines).toEqual(['{"a":1}'])
    expect(offset).toBe(byteLength(complete))
  })

  it('stays at the start of the read for an empty file', async () => {
    const filePath = writeFixture('')

    const { lines, offset } = await readWithCursor(filePath)

    expect(lines).toEqual([])
    expect(offset).toBe(0)
  })

  it('has already moved past a line when the consumer receives it', async () => {
    const filePath = writeFixture('{"a":1}\n{"a":2}\n{"a":3}\n')
    const cursor: ReadCursor = { offset: -1 }

    for await (const result of readJsonlLines(filePath, { cursor })) {
      if (result.ok && result.value === '{"a":2}') break
    }

    expect(cursor.offset).toBe(byteLength('{"a":1}\n{"a":2}\n'))
  })
})

describe('readJsonlLines start', () => {
  it.each(CHUNK_SIZES)(
    'yields exactly the lines after the reported offset (highWaterMark %i)',
    async (highWaterMark) => {
      const filePath = writeFixture(`{"a":"${MULTIBYTE_TEXT}"}\n{"b":2}\n{"c":3, incompl`)
      const first = await readWithCursor(filePath, { highWaterMark })

      appendFileSync(filePath, '"d"}\n{"e":5}\n', 'utf-8')
      const resumed = await readWithCursor(filePath, { highWaterMark, start: first.offset })

      expect(resumed.lines).toEqual(['{"c":3, incompl"d"}', '{"e":5}'])
    }
  )

  it('starts the cursor at the start offset when no line completes', async () => {
    const filePath = writeFixture('{"a":1}\n{"b":2')

    const { lines, offset } = await readWithCursor(filePath, { start: byteLength('{"a":1}\n') })

    expect(lines).toEqual([])
    expect(offset).toBe(byteLength('{"a":1}\n'))
  })

  it('yields nothing and keeps the offset when start is at the end of the file', async () => {
    const content = '{"a":1}\n'
    const filePath = writeFixture(content)

    const { lines, offset } = await readWithCursor(filePath, { start: byteLength(content) })

    expect(lines).toEqual([])
    expect(offset).toBe(byteLength(content))
  })

  it('keeps a byte order mark that begins a resumed line', async () => {
    const filePath = writeFixture('{"a":1}\n\uFEFF{"b":2}\n')

    const { lines } = await readWithCursor(filePath, { start: byteLength('{"a":1}\n') })

    expect(lines).toEqual(['\uFEFF{"b":2}'])
  })

  it('keeps a byte order mark mid-file in a full read, stripping only the one at the start', async () => {
    const filePath = writeFixture('\uFEFF{"a":1}\n\uFEFF{"b":2}\n')

    const { lines } = await readWithCursor(filePath)

    expect(lines).toEqual(['{"a":1}', '\uFEFF{"b":2}'])
  })

  it('rejects a negative start', async () => {
    const filePath = writeFixture('{"a":1}\n')

    await expect(readWithCursor(filePath, { start: -1 })).rejects.toThrow(RangeError)
  })
})
