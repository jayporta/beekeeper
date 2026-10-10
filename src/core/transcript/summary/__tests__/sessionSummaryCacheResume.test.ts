import * as fs from 'node:fs'
import { appendFileSync, renameSync, truncateSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadJsonlLinesOptions } from '../../readJsonlLines'
import type { TranscriptFileInfo } from '../../statTranscriptFile'
import { statWrittenTranscript } from '../../testStatTranscript'
import { buildAiTitleRecord, buildJsonlText } from '../../testFixtures'
import { scanSessionSummary } from '../scanSessionSummary'
import { createSessionSummaryCache, type SessionSummaryCache } from '../sessionSummaryCache'
import { createSummaryScan } from '../summaryScan'
import { RESUME_ENTRY_OVERHEAD, resumeWeight } from '../summaryResume'
import {
  buildTrickyTranscript,
  createGrowingTranscript,
  TRICKY_MAX_LINE_CHARS,
  type GrowingTranscript
} from '../testGrowingTranscript'
import { createTranscriptDir, type TranscriptDir } from '../testTranscriptDir'

// Wraps the real `createReadStream` in a spy so a test can see where each
// read began, which is how a resumed read tells from a rescan.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) }
})

let dir: TranscriptDir

beforeEach(() => {
  dir = createTranscriptDir()
  vi.mocked(fs.createReadStream).mockClear()
})

afterEach(() => {
  dir.cleanup()
})

/** A modification time later than any a growing transcript carries, in seconds. */
const LATER_SECONDS = 1_900_000_000

/** The scan tuning the tests share: the oversized line in the script is over the cap. */
function tuning(highWaterMark?: number): ReadJsonlLinesOptions {
  return { maxLineChars: TRICKY_MAX_LINE_CHARS, highWaterMark }
}

/** Where each read began while `action` ran, in order. */
async function startsDuring(action: () => Promise<unknown>): Promise<number[]> {
  const before = vi.mocked(fs.createReadStream).mock.calls.length
  await action()
  return vi
    .mocked(fs.createReadStream)
    .mock.calls.slice(before)
    .map(([, options]) => (typeof options === 'object' ? (options.start ?? 0) : 0))
}

/** The offset just past the last newline in `bytes`: what a scan of them consumes. */
function consumedOffset(bytes: Buffer): number {
  return bytes.lastIndexOf(0x0a) + 1
}

/**
 * Reads through the cache and checks the summary against a fresh scan of the
 * same bytes. The fresh scan reads in the default chunk size whatever chunk
 * size `options` gives the cache, so it also shows a summary does not depend
 * on how the bytes were chunked.
 *
 * @returns Where the cache's own read began, or -1 when it did not read the file.
 */
async function readAndCompare(
  cache: SessionSummaryCache,
  file: TranscriptFileInfo,
  options: ReadJsonlLinesOptions
): Promise<number> {
  let result: Awaited<ReturnType<SessionSummaryCache['read']>> | undefined
  const starts = await startsDuring(async () => {
    result = await cache.read(file)
  })
  if (result === undefined || !result.ok) throw new Error('Expected a summary')
  const fresh = await scanSessionSummary(file.path, { maxLineChars: options.maxLineChars })
  expect(result.value).toEqual(fresh)
  return starts[0] ?? -1
}

/**
 * Grows the script one slice at a time, reading through the cache after each,
 * and checks every summary against a fresh scan and every read's start
 * against the offset the previous read consumed through.
 */
async function growAndCheck(
  growing: GrowingTranscript,
  script: Buffer,
  highWaterMark?: number
): Promise<void> {
  const options = tuning(highWaterMark)
  const cache = createSessionSummaryCache({ readOptions: options })
  let expectedStart = 0

  while (growing.grow()) {
    expect(await readAndCompare(cache, await growing.stat(), options)).toBe(expectedStart)
    expectedStart = consumedOffset(script.subarray(0, growing.written()))
  }
}

/** A transcript holding all of the tricky script, read once through a cache. */
async function cachedTranscript(): Promise<{
  cache: SessionSummaryCache
  path: string
  script: Buffer
}> {
  const script = buildTrickyTranscript()
  const path = join(dir.root, 'session.jsonl')
  const growing = createGrowingTranscript({ path, script, seed: 1, maxStep: 1 })
  growing.growTo(script.length)
  const cache = createSessionSummaryCache({ readOptions: tuning() })
  await readAndCompare(cache, await growing.stat(), tuning())
  return { cache, path, script }
}

describe('createSessionSummaryCache resuming', () => {
  describe('equals a fresh scan of the same bytes after every append', () => {
    const SEEDS = [
      { seed: 1, highWaterMark: undefined },
      { seed: 2, highWaterMark: 7 },
      { seed: 3, highWaterMark: 13 },
      { seed: 4, highWaterMark: 64 },
      { seed: 5, highWaterMark: 4096 },
      { seed: 6, highWaterMark: 3 }
    ]

    it.each(SEEDS)(
      'for random-sized appends (seed $seed, chunks of $highWaterMark bytes)',
      async ({ seed, highWaterMark }) => {
        const script = buildTrickyTranscript()
        const growing = createGrowingTranscript({
          path: join(dir.root, 'session.jsonl'),
          script,
          seed,
          maxStep: 300
        })

        await growAndCheck(growing, script, highWaterMark)
      }
    )

    it('for one-byte appends, so every character and line splits at every point', async () => {
      const script = buildTrickyTranscript().subarray(0, 450)
      const growing = createGrowingTranscript({
        path: join(dir.root, 'session.jsonl'),
        script,
        seed: 1,
        maxStep: 1
      })

      await growAndCheck(growing, script, 5)
    })

    it('when a resume begins at a line that starts with a byte order mark', async () => {
      const script = buildTrickyTranscript()
      const growing = createGrowingTranscript({
        path: join(dir.root, 'session.jsonl'),
        script,
        seed: 1,
        maxStep: 1
      })
      const options = tuning()
      const cache = createSessionSummaryCache({ readOptions: options })
      const markStart = script.indexOf(Buffer.from('\uFEFF', 'utf-8'))
      // The first read ends inside the mark's own bytes.
      growing.growTo(markStart + 2)
      await readAndCompare(cache, await growing.stat(), options)

      growing.growTo(markStart + 80)
      const start = await readAndCompare(cache, await growing.stat(), options)

      expect(start).toBe(markStart)
    })

    it('for a file that begins with a byte order mark', async () => {
      const script = buildTrickyTranscript({ startWithBom: true })
      const growing = createGrowingTranscript({
        path: join(dir.root, 'session.jsonl'),
        script,
        seed: 7,
        maxStep: 400
      })

      await growAndCheck(growing, script, 9)
    })
  })

  describe('rescans in full', () => {
    const options = tuning()

    it('when the file shrank', async () => {
      const { cache, path } = await cachedTranscript()

      truncateSync(path, 2000)
      utimesSync(path, LATER_SECONDS, LATER_SECONDS)

      expect(await readAndCompare(cache, await statWrittenTranscript(path), options)).toBe(0)
    })

    it('when the file changed at the same size', async () => {
      const { cache, path, script } = await cachedTranscript()

      writeFileSync(path, Buffer.from(script).fill(0x78, 0, 40))
      utimesSync(path, LATER_SECONDS, LATER_SECONDS)

      expect(await readAndCompare(cache, await statWrittenTranscript(path), options)).toBe(0)
    })

    it('when the file grew but its modification time did not change', async () => {
      const { cache, path } = await cachedTranscript()
      const before = await statWrittenTranscript(path)

      appendFileSync(path, '{"type":"ai-title","aiTitle":"More"}\n')
      utimesSync(path, before.mtimeMs / 1000, before.mtimeMs / 1000)

      expect(await readAndCompare(cache, await statWrittenTranscript(path), options)).toBe(0)
    })

    it('when the start of the file was replaced', async () => {
      const { cache, path, script } = await cachedTranscript()

      const rewritten = Buffer.concat([
        Buffer.from('{"type":"ai-title","aiTitle":"Replaced"}\n'),
        script.subarray(41),
        Buffer.from('{"type":"ai-title","aiTitle":"More"}\n')
      ])
      writeFileSync(path, rewritten)
      utimesSync(path, LATER_SECONDS, LATER_SECONDS)

      expect(await readAndCompare(cache, await statWrittenTranscript(path), options)).toBe(0)
    })

    it('when another file took its place', async () => {
      const { cache, path, script } = await cachedTranscript()

      const replacement = join(dir.root, 'replacement.jsonl')
      writeFileSync(replacement, Buffer.concat([script, Buffer.from('{"a":1}\n')]))
      utimesSync(replacement, LATER_SECONDS, LATER_SECONDS)
      renameSync(replacement, path)

      expect(await readAndCompare(cache, await statWrittenTranscript(path), options)).toBe(0)
    })

    it('when the newline before the consumed offset was overwritten', async () => {
      const { cache, path, script } = await cachedTranscript()

      const edited = Buffer.concat([script, Buffer.from('{"a":1}\n')])
      edited[consumedOffset(script) - 1] = 0x20
      writeFileSync(path, edited)
      utimesSync(path, LATER_SECONDS, LATER_SECONDS)

      expect(await readAndCompare(cache, await statWrittenTranscript(path), options)).toBe(0)
    })
  })

  describe('picks the offset to resume from', () => {
    const options = tuning()

    /** A file that ends exactly at a line end, read once with a size that was stat'd 5 bytes short. */
    async function cachedWithUnderstatedSize(): Promise<{
      cache: SessionSummaryCache
      growing: GrowingTranscript
      lineEnd: number
      file: TranscriptFileInfo
    }> {
      const script = buildTrickyTranscript()
      const growing = createGrowingTranscript({
        path: join(dir.root, 'session.jsonl'),
        script,
        seed: 1,
        maxStep: 1
      })
      const lineEnd = script.indexOf(0x0a, 300) + 1
      growing.growTo(lineEnd)
      const cache = createSessionSummaryCache({ readOptions: options })
      const file = await growing.stat()
      // The file is longer than this stat says, as when it grows during the scan.
      await cache.read({ ...file, size: file.size - 5 })
      return { cache, growing, lineEnd, file }
    }

    it('resumes from what the scan consumed, not the size it was stat\u2019d at', async () => {
      const { cache, growing, lineEnd } = await cachedWithUnderstatedSize()

      growing.growTo(4000)
      const start = await readAndCompare(cache, await growing.stat(), options)

      expect(start).toBe(lineEnd)
    })

    it('rescans in full when the size is below what the scan consumed', async () => {
      const { cache, file } = await cachedWithUnderstatedSize()

      const [start] = await startsDuring(() =>
        cache.read({ ...file, size: file.size - 4, mtimeMs: file.mtimeMs + 1 })
      )

      expect(start).toBe(0)
    })
  })

  describe('keeps resumable scans within their own bound', () => {
    const options = tuning()
    const FIRST_TITLE = buildJsonlText([buildAiTitleRecord('title-aa')])
    const SECOND_TITLE = buildJsonlText([buildAiTitleRecord('title-bb')])

    /** What the scan of a title-only file weighs once stored, as the cache weighs it. */
    const ONE_SCAN = resumeWeight({
      scan: createSummaryScan(),
      mark: { ino: 0, dev: 0, prefix: Buffer.from(FIRST_TITLE) },
      mtimeMs: 0,
      size: 0,
      offset: 0
    })

    /** Writes and reads three title-only files through `cache`, then appends to each. */
    async function threeGrownFiles(cache: SessionSummaryCache): Promise<string[]> {
      const paths = ['a', 'b', 'c'].map((name) => join(dir.root, `${name}.jsonl`))
      for (const path of paths) {
        writeFileSync(path, FIRST_TITLE)
        await cache.read(await statWrittenTranscript(path))
      }
      for (const path of paths) {
        appendFileSync(path, SECOND_TITLE)
        utimesSync(path, LATER_SECONDS, LATER_SECONDS)
      }
      return paths
    }

    it('weighs a stored scan by its entry overhead, its observers and its prefix', () => {
      const prefixUnits = Math.ceil(Buffer.byteLength(FIRST_TITLE) / 2)

      expect(ONE_SCAN).toBe(RESUME_ENTRY_OVERHEAD + createSummaryScan().weight() + prefixUnits)
    })

    it('resumes the scans it kept and rescans the one it evicted', async () => {
      const cache = createSessionSummaryCache({
        readOptions: options,
        maxResumeWeight: 2 * ONE_SCAN + 200
      })
      const [a, b, c] = await threeGrownFiles(cache)

      const starts: number[] = []
      for (const path of [c, b, a]) {
        const [start] = await startsDuring(async () =>
          cache.read(await statWrittenTranscript(path as string))
        )
        starts.push(start ?? -1)
      }

      expect(starts.map((start) => start > 0)).toEqual([true, true, false])
    })

    it('does not keep a scan heavier than the whole bound, but still returns its summary', async () => {
      const cache = createSessionSummaryCache({ readOptions: options, maxResumeWeight: 100 })
      const [a] = await threeGrownFiles(cache)
      const file = await statWrittenTranscript(a as string)

      expect(await readAndCompare(cache, file, options)).toBe(0)
    })
  })

  it('rescans in full after a read failed partway through the new lines', async () => {
    const options = tuning()
    const script = buildTrickyTranscript()
    const growing = createGrowingTranscript({
      path: join(dir.root, 'session.jsonl'),
      script,
      seed: 1,
      maxStep: 1
    })
    growing.growTo(300)
    const cache = createSessionSummaryCache({ readOptions: options })
    await cache.read(await growing.stat())
    const consumed = consumedOffset(script.subarray(0, 300))
    growing.growTo(script.length)
    const grown = await growing.stat()

    // The next read delivers every new line, then fails.
    async function* newLinesThenFailure(): AsyncGenerator<Buffer> {
      yield Buffer.from(script.subarray(consumed))
      throw Object.assign(new Error('read failed'), { code: 'EIO' })
    }
    vi.mocked(fs.createReadStream).mockImplementationOnce(
      () => Readable.from(newLinesThenFailure()) as unknown as fs.ReadStream
    )
    const failed = await cache.read(grown)

    expect(failed).toEqual({ ok: false, error: { reason: 'unreadable', code: 'EIO' } })
    expect(await readAndCompare(cache, grown, options)).toBe(0)
  })

  it('shares one scan between reads of a file that overlap', async () => {
    const options = tuning()
    const script = buildTrickyTranscript()
    const growing = createGrowingTranscript({
      path: join(dir.root, 'session.jsonl'),
      script,
      seed: 1,
      maxStep: 1
    })
    growing.growTo(2000)
    const cache = createSessionSummaryCache({ readOptions: options })
    await cache.read(await growing.stat())
    growing.growTo(4000)
    const grown = await growing.stat()

    const starts = await startsDuring(async () => {
      const results = await Promise.all([cache.read(grown), cache.read({ ...grown })])
      expect(results[1]).toEqual(results[0])
    })

    expect(starts).toEqual([consumedOffset(script.subarray(0, 2000))])
  })
})
