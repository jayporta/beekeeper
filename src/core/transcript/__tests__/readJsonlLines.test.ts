import * as fs from 'node:fs'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readJsonlLines,
  type LineTooLongError,
  type ReadJsonlLinesOptions
} from '../readJsonlLines'
import type { Result } from '../result'
import { buildJsonlTextWithPartialLastLine, MULTIBYTE_TEXT } from '../testFixtures'

// Wraps the real `createReadStream` in a spy so the "closes early" test can
// see which stream got created, without touching any other `node:fs` export.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) }
})

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-transcript-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeFixture(name: string, content: string): string {
  const filePath = join(dir, name)
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

async function collectResults(
  filePath: string,
  options?: ReadJsonlLinesOptions
): Promise<Array<Result<string, LineTooLongError>>> {
  const results: Array<Result<string, LineTooLongError>> = []
  for await (const result of readJsonlLines(filePath, options)) {
    results.push(result)
  }
  return results
}

async function collectLines(filePath: string, options?: ReadJsonlLinesOptions): Promise<string[]> {
  const results = await collectResults(filePath, options)
  return results.map((result) => {
    if (!result.ok) throw new Error('Expected only ok results')
    return result.value
  })
}

describe('readJsonlLines', () => {
  it('drops a trailing partial line with no newline', async () => {
    const filePath = writeFixture(
      'partial.jsonl',
      buildJsonlTextWithPartialLastLine([{ a: 1 }, { a: 2 }], '{"a":3, incompl')
    )

    const lines = await collectLines(filePath)

    expect(lines).toEqual(['{"a":1}', '{"a":2}'])
  })

  it('reassembles a multi-byte character split across a chunk boundary', async () => {
    const filePath = writeFixture('multibyte.jsonl', `${MULTIBYTE_TEXT}\nsecond line\n`)

    const lines = await collectLines(filePath, { highWaterMark: 9 })

    expect(lines).toEqual([MULTIBYTE_TEXT, 'second line'])
  })

  it('strips a trailing carriage return', async () => {
    const filePath = writeFixture('crlf.jsonl', '{"a":1}\r\n{"a":2}\r\n')

    const lines = await collectLines(filePath)

    expect(lines).toEqual(['{"a":1}', '{"a":2}'])
  })

  it('skips empty lines', async () => {
    const filePath = writeFixture('empty-lines.jsonl', '{"a":1}\n\n\n{"a":2}\n')

    const lines = await collectLines(filePath)

    expect(lines).toEqual(['{"a":1}', '{"a":2}'])
  })

  it('yields a line larger than the stream default chunk size intact', async () => {
    const bigLine = JSON.stringify({ a: 'x'.repeat(3_200_000) })
    const filePath = writeFixture('large.jsonl', `${bigLine}\n{"a":"small"}\n`)

    const lines = await collectLines(filePath)

    expect(lines).toEqual([bigLine, '{"a":"small"}'])
  })

  it('yields nothing for an empty file', async () => {
    const filePath = writeFixture('empty-file.jsonl', '')

    const results = await collectResults(filePath)

    expect(results).toEqual([])
  })

  it('rejects when the file does not exist', async () => {
    const filePath = join(dir, 'missing.jsonl')

    await expect(collectResults(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports one error for an oversized line and still yields the lines after it', async () => {
    const filePath = writeFixture('oversized.jsonl', `${'x'.repeat(50)}\nshort\n`)

    const results = await collectResults(filePath, { maxLineChars: 20 })

    expect(results).toEqual([
      { ok: false, error: { reason: 'line-too-long' } },
      { ok: true, value: 'short' }
    ])
  })

  it('yields nothing for an oversized line with no terminating newline', async () => {
    const filePath = writeFixture('oversized-unterminated.jsonl', 'x'.repeat(50))

    const results = await collectResults(filePath, { maxLineChars: 20 })

    expect(results).toEqual([])
  })

  it('reports one error for an oversized line spanning several chunks, then keeps going', async () => {
    const filePath = writeFixture('oversized-multichunk.jsonl', `${'x'.repeat(50)}\nshort\n`)

    const results = await collectResults(filePath, { highWaterMark: 8, maxLineChars: 20 })

    expect(results).toEqual([
      { ok: false, error: { reason: 'line-too-long' } },
      { ok: true, value: 'short' }
    ])
  })

  it('passes a CRLF line whose content is exactly maxLineChars - 1 characters', async () => {
    const line = 'A'.repeat(19)
    const filePath = writeFixture('crlf-at-cap.jsonl', `${line}\r\nnext\n`)

    const results = await collectResults(filePath, { highWaterMark: 20, maxLineChars: 20 })

    expect(results).toEqual([
      { ok: true, value: line },
      { ok: true, value: 'next' }
    ])
  })

  it('destroys the underlying stream when the consumer stops iterating early', async () => {
    const filePath = writeFixture('close-early.jsonl', '{"a":1}\n{"a":2}\n{"a":3}\n')
    vi.mocked(fs.createReadStream).mockClear()

    const iterator = readJsonlLines(filePath)
    await iterator.next()
    await iterator.return()

    const stream = vi.mocked(fs.createReadStream).mock.results.at(-1)?.value as fs.ReadStream
    expect(stream.destroyed).toBe(true)
  })
})
