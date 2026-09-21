import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readRecords, type SkippedLineError } from '../readRecords'
import type { Result } from '../result'
import { buildAiTitleRecord, buildJsonlText, toJsonlLine } from '../testFixtures'

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

async function collect(
  filePath: string,
  maxLineChars?: number
): Promise<Array<Result<Record<string, unknown>, SkippedLineError>>> {
  const results: Array<Result<Record<string, unknown>, SkippedLineError>> = []
  for await (const result of readRecords(filePath, { maxLineChars })) {
    results.push(result)
  }
  return results
}

describe('readRecords', () => {
  it('yields a parsed record for a well-formed line', async () => {
    const record = buildAiTitleRecord('Fix the bug')
    const filePath = writeFixture('valid.jsonl', buildJsonlText([record]))

    const results = await collect(filePath)

    expect(results).toEqual([{ ok: true, value: record }])
  })

  it('reports a line too long to buffer', async () => {
    const filePath = writeFixture(
      'oversized.jsonl',
      `${'x'.repeat(50)}\n${toJsonlLine({ a: 1 })}\n`
    )

    const results = await collect(filePath, 20)

    expect(results).toEqual([
      { ok: false, error: { reason: 'line-too-long' } },
      { ok: true, value: { a: 1 } }
    ])
  })

  it('reports invalid JSON', async () => {
    const filePath = writeFixture('malformed.jsonl', '{"broken": \n')

    const results = await collect(filePath)

    expect(results).toEqual([{ ok: false, error: { reason: 'invalid-json' } }])
  })

  it('reports valid JSON that is not an object', async () => {
    const filePath = writeFixture('non-object.jsonl', '[1, 2, 3]\n"a string"\n42\n')

    const results = await collect(filePath)

    expect(results).toEqual([
      { ok: false, error: { reason: 'not-an-object' } },
      { ok: false, error: { reason: 'not-an-object' } },
      { ok: false, error: { reason: 'not-an-object' } }
    ])
  })

  it('yields nothing for an empty file', async () => {
    const filePath = writeFixture('empty.jsonl', '')

    const results = await collect(filePath)

    expect(results).toEqual([])
  })

  it('rejects when the file does not exist', async () => {
    const filePath = join(dir, 'missing.jsonl')

    await expect(collect(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
