import {
  appendFileSync,
  mkdtempSync,
  renameSync,
  rmSync,
  truncateSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installFileSystem } from '../../io/installFileSystem'
import { nodeFileSystem } from '../../io/node/nodeFileSystem'
import type { TranscriptFileInfo } from '../statTranscriptFile'
import { statWrittenTranscript } from '../testStatTranscript'
import { confirmTailMark, readTailMark, TAIL_MARK_PREFIX_BYTES } from '../tailMark'

let dir: string
let path: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-tailmark-'))
  path = join(dir, 'session.jsonl')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const stat = (): Promise<TranscriptFileInfo> => statWrittenTranscript(path)

/** A fixture of whole lines, longer than the prefix, so the offset can sit past it. */
function longLines(count: number): string {
  return Array.from({ length: count }, (_, n) => `{"n":${n},"pad":"${'x'.repeat(100)}"}\n`).join('')
}

describe('readTailMark', () => {
  it("captures the file's identity and its first bytes", async () => {
    writeFileSync(path, '{"a":1}\n')
    const file = await stat()

    const mark = await readTailMark(file)

    expect(mark).toEqual({
      ino: file.ino,
      dev: file.dev,
      prefix: new Uint8Array(Buffer.from('{"a":1}\n'))
    })
  })

  it('captures at most the prefix length of a longer file', async () => {
    writeFileSync(path, longLines(100))

    const mark = await readTailMark(await stat())

    expect(mark.prefix.byteLength).toBe(TAIL_MARK_PREFIX_BYTES)
  })

  it('captures an empty prefix for an empty file', async () => {
    writeFileSync(path, '')

    const mark = await readTailMark(await stat())

    expect(mark.prefix.byteLength).toBe(0)
  })

  it('rejects with the system error code when the file is gone', async () => {
    writeFileSync(path, '{"a":1}\n')
    const file = await stat()
    rmSync(path)

    await expect(readTailMark(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('confirmTailMark', () => {
  it('confirms a file that only grew past the offset', async () => {
    const consumed = longLines(60)
    writeFileSync(path, consumed)
    const mark = await readTailMark(await stat())

    appendFileSync(path, longLines(5))
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength(consumed)
    })

    expect(confirmed).toEqual(mark)
  })

  it('confirms an offset of zero without a byte to check before it', async () => {
    writeFileSync(path, '{"a":1')
    const mark = await readTailMark(await stat())

    appendFileSync(path, '}\n')
    const confirmed = await confirmTailMark({ file: await stat(), mark, offset: 0 })

    expect(confirmed).not.toBeNull()
  })

  it('confirms an offset inside the prefix', async () => {
    writeFileSync(path, '{"a":1}\n{"b":2')
    const mark = await readTailMark(await stat())

    appendFileSync(path, '}\n')
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength('{"a":1}\n')
    })

    expect(confirmed).not.toBeNull()
  })

  it('returns a longer prefix once a short file has grown', async () => {
    writeFileSync(path, '{"a":1}\n')
    const mark = await readTailMark(await stat())

    appendFileSync(path, longLines(60))
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength('{"a":1}\n')
    })

    expect(confirmed?.prefix.byteLength).toBe(TAIL_MARK_PREFIX_BYTES)
  })

  it('rejects a file replaced at the same path', async () => {
    const consumed = longLines(60)
    writeFileSync(path, consumed)
    const mark = await readTailMark(await stat())

    const replacement = join(dir, 'replacement.jsonl')
    writeFileSync(replacement, consumed + longLines(5))
    renameSync(replacement, path)
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength(consumed)
    })

    expect(confirmed).toBeNull()
  })

  it('rejects a file on another device', async () => {
    const consumed = longLines(60)
    writeFileSync(path, consumed)
    const file = await stat()
    const mark = await readTailMark(file)

    const confirmed = await confirmTailMark({
      file: { ...file, dev: file.dev + 1 },
      mark,
      offset: Buffer.byteLength(consumed)
    })

    expect(confirmed).toBeNull()
  })

  it('rejects a file whose first bytes were rewritten in place', async () => {
    const consumed = longLines(60)
    writeFileSync(path, consumed)
    const mark = await readTailMark(await stat())

    writeFileSync(path, consumed.replace('"n":0', '"n":9') + longLines(5))
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength(consumed)
    })

    expect(confirmed).toBeNull()
  })

  it('rejects a file cut shorter than the prefix it was marked with', async () => {
    writeFileSync(path, longLines(60))
    const mark = await readTailMark(await stat())

    truncateSync(path, 100)
    const confirmed = await confirmTailMark({ file: await stat(), mark, offset: 100 })

    expect(confirmed).toBeNull()
  })

  it('rejects an offset past the end of the file', async () => {
    const consumed = longLines(60)
    writeFileSync(path, consumed)
    const mark = await readTailMark(await stat())

    truncateSync(path, TAIL_MARK_PREFIX_BYTES + 50)
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength(consumed)
    })

    expect(confirmed).toBeNull()
  })

  it('rejects an offset that no longer follows a newline, past the prefix', async () => {
    const consumed = longLines(60)
    writeFileSync(path, consumed)
    const mark = await readTailMark(await stat())

    const edited = Buffer.from(consumed + longLines(5))
    edited[Buffer.byteLength(consumed) - 1] = 0x20
    writeFileSync(path, edited)
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark,
      offset: Buffer.byteLength(consumed)
    })

    expect(confirmed).toBeNull()
  })

  it('rejects an offset that no longer follows a newline, inside the prefix', async () => {
    writeFileSync(path, '{"a":1}\n{"b":2}\n')
    const mark = await readTailMark(await stat())

    const edited = Buffer.from('{"a":1}\n{"b":2}\n')
    edited[7] = 0x20
    writeFileSync(path, edited)
    const confirmed = await confirmTailMark({
      file: await stat(),
      mark: { ...mark, prefix: Buffer.from('{"a":1}') },
      offset: Buffer.byteLength('{"a":1}\n')
    })

    expect(confirmed).toBeNull()
  })

  it('rejects with the system error code when the file is gone', async () => {
    writeFileSync(path, longLines(5))
    const file = await stat()
    const mark = await readTailMark(file)
    rmSync(path)

    await expect(confirmTailMark({ file, mark, offset: 0 })).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})

describe('confirmTailMark on a port without file identity', () => {
  afterEach(() => {
    installFileSystem(nodeFileSystem)
  })

  it('confirms by prefix and newline alone when the inode and device are unknown', async () => {
    const consumed = longLines(60)
    const served = new Uint8Array(Buffer.from(consumed + longLines(5)))
    installFileSystem({
      ...nodeFileSystem,
      readRange: async (_path, { position, length }) =>
        served.subarray(position, Math.min(position + length, served.byteLength))
    })
    const file: TranscriptFileInfo = {
      path: '/virtual/session.jsonl',
      mtimeMs: 0,
      size: served.byteLength,
      ino: 0,
      dev: 0
    }

    const mark = await readTailMark(file)
    const confirmed = await confirmTailMark({ file, mark, offset: Buffer.byteLength(consumed) })

    expect(confirmed).toEqual(mark)
  })
})
