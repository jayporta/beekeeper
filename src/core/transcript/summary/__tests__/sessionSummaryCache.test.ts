import { basename, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Result } from '../../../shared/result'
import type { TranscriptFileInfo } from '../../statTranscriptFile'
import { buildAiTitleRecord, buildJsonlText } from '../../testFixtures'
import type { UnreadableError } from '../../unreadableError'
import { createSessionSummaryCache } from '../sessionSummaryCache'
import type { SessionSummary } from '../sessionSummary'
import { SUMMARY_ENTRY_OVERHEAD } from '../summaryWeight'
import { createTranscriptDir, type TranscriptDir } from '../testTranscriptDir'

let dir: TranscriptDir

beforeEach(() => {
  dir = createTranscriptDir()
})

afterEach(() => {
  dir.cleanup()
})

/** Writes a transcript holding one `ai-title` record and stats it as discovery would. */
function writeTranscript(name: string, title: string): TranscriptFileInfo {
  return dir.write(name, buildJsonlText([buildAiTitleRecord(title)]))
}

/** Unwraps a successful read, failing the test when the scan reported an error. */
function expectTitle(result: Result<SessionSummary, UnreadableError>): string | null {
  if (!result.ok) throw new Error(`Expected a summary, got ${result.error.code}`)
  return result.value.title
}

describe('createSessionSummaryCache', () => {
  it('scans a transcript it has not seen', async () => {
    const file = writeTranscript('session.jsonl', 'First run')
    const cache = createSessionSummaryCache()

    const result = await cache.read(file)

    expect(expectTitle(result)).toBe('First run')
  })

  it('serves the cached scan while mtime and size are unchanged', async () => {
    const file = writeTranscript('session.jsonl', 'Cached title')
    const cache = createSessionSummaryCache()
    await cache.read(file)

    // Same length, so rewriting it in place leaves the size the caller
    // holds correct; only a rescan could pick the new title up.
    dir.write('session.jsonl', buildJsonlText([buildAiTitleRecord('Rewritten...')]))
    const result = await cache.read(file)

    expect(expectTitle(result)).toBe('Cached title')
  })

  it('rescans when the file has grown, even at an unchanged mtime', async () => {
    const file = writeTranscript('session.jsonl', 'Before')
    const cache = createSessionSummaryCache()
    await cache.read(file)

    const rewritten = dir.write(
      'session.jsonl',
      buildJsonlText([buildAiTitleRecord('After more was appended')])
    )
    const grown = { ...file, size: rewritten.size }
    const result = await cache.read(grown)

    expect(expectTitle(result)).toBe('After more was appended')
  })

  it('rescans when the file was modified at an unchanged size', async () => {
    const file = writeTranscript('session.jsonl', 'Before')
    const cache = createSessionSummaryCache()
    await cache.read(file)

    dir.write('session.jsonl', buildJsonlText([buildAiTitleRecord('After.')]))
    const touched = { ...file, mtimeMs: file.mtimeMs + 1000 }
    const result = await cache.read(touched)

    expect(expectTitle(result)).toBe('After.')
  })

  it('caches each transcript separately', async () => {
    const one = writeTranscript('one.jsonl', 'Session one')
    const two = writeTranscript('two.jsonl', 'Session two')
    const cache = createSessionSummaryCache()

    const results = [await cache.read(one), await cache.read(two), await cache.read(one)]

    expect(results.map(expectTitle)).toEqual(['Session one', 'Session two', 'Session one'])
  })

  it('reports an unreadable transcript as an error code, without its path', async () => {
    const missing: TranscriptFileInfo = { path: join(dir.root, 'gone.jsonl'), mtimeMs: 1, size: 1 }
    const cache = createSessionSummaryCache()

    const result = await cache.read(missing)

    expect(result).toEqual({ ok: false, error: { reason: 'unreadable', code: 'ENOENT' } })
  })

  describe('eviction', () => {
    // A title-only summary weighs the entry overhead plus the title, so this
    // bound holds two eight-character titles and not three.
    const TWO_ENTRIES = 2 * (SUMMARY_ENTRY_OVERHEAD + 8) + 10

    /**
     * Rewrites a transcript with a same-length title and returns the file
     * as it was before, so a read through it tells a cached summary (the old
     * title) from a rescan (the new one).
     */
    function rewriteKeepingSize(file: TranscriptFileInfo, title: string): TranscriptFileInfo {
      dir.write(basename(file.path), buildJsonlText([buildAiTitleRecord(title)]))
      return file
    }

    it('serves the cached summary before eviction and rescans after it', async () => {
      const cache = createSessionSummaryCache({ maxWeight: TWO_ENTRIES })
      const a = writeTranscript('a.jsonl', 'title-aa')
      const b = writeTranscript('b.jsonl', 'title-bb')
      const c = writeTranscript('c.jsonl', 'title-cc')
      await cache.read(a)

      const beforeEviction = expectTitle(await cache.read(rewriteKeepingSize(a, 'newer-aa')))
      await cache.read(b)
      await cache.read(c)
      const afterEviction = expectTitle(await cache.read(a))

      expect([beforeEviction, afterEviction]).toEqual(['title-aa', 'newer-aa'])
    })

    it('keeps the total weight within the bound, dropping the least recently read', async () => {
      const cache = createSessionSummaryCache({ maxWeight: TWO_ENTRIES })
      const files = ['1', '2', '3', '4', '5'].map((n) =>
        writeTranscript(`${n}.jsonl`, `title-0${n}`)
      )
      for (const file of files) await cache.read(file)
      for (const [index, file] of files.entries()) {
        rewriteKeepingSize(file, `newer-0${index + 1}`)
      }

      const titles: (string | null)[] = []
      for (const file of [...files].reverse()) titles.push(expectTitle(await cache.read(file)))

      expect(titles).toEqual(['title-05', 'title-04', 'newer-03', 'newer-02', 'newer-01'])
    })

    it('does not keep a summary heavier than the whole bound, but still returns it', async () => {
      const cache = createSessionSummaryCache({ maxWeight: SUMMARY_ENTRY_OVERHEAD })
      const file = writeTranscript('big.jsonl', 'title-aa')

      const first = expectTitle(await cache.read(file))
      const second = expectTitle(await cache.read(rewriteKeepingSize(file, 'newer-aa')))

      expect([first, second]).toEqual(['title-aa', 'newer-aa'])
    })

    it('serves a second pass over a 600-transcript folder from cache at the default bound', async () => {
      const cache = createSessionSummaryCache()
      const files = Array.from({ length: 600 }, (_, n) =>
        writeTranscript(`s${n}.jsonl`, `sess-${String(n).padStart(4, '0')}`)
      )
      for (const file of files) await cache.read(file)
      const sampled = files.filter((_, n) => n % 50 === 0)
      for (const [index, file] of sampled.entries()) {
        rewriteKeepingSize(file, `redo-${String(index * 50).padStart(4, '0')}`)
      }

      const titles: (string | null)[] = []
      for (const file of files) titles.push(expectTitle(await cache.read(file)))

      const sampledIndexes = sampled.map((_, index) => index * 50)
      expect(sampledIndexes.map((n) => titles[n])).toEqual(
        sampledIndexes.map((n) => `sess-${String(n).padStart(4, '0')}`)
      )
    })
  })

  it('does not cache a failed scan', async () => {
    const missing: TranscriptFileInfo = { path: join(dir.root, 'later.jsonl'), mtimeMs: 1, size: 1 }
    const cache = createSessionSummaryCache()
    expect((await cache.read(missing)).ok).toBe(false)

    dir.write('later.jsonl', buildJsonlText([buildAiTitleRecord('Arrived late')]))
    const result = await cache.read(missing)

    expect(expectTitle(result)).toBe('Arrived late')
  })
})
