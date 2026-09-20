import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Result } from '../../result'
import type { TranscriptFileInfo } from '../../statTranscriptFile'
import { buildAiTitleRecord, buildJsonlText } from '../../testFixtures'
import type { UnreadableError } from '../../unreadableError'
import { createSessionSummaryCache } from '../sessionSummaryCache'
import type { SessionSummary } from '../sessionSummary'
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

  it('does not cache a failed scan', async () => {
    const missing: TranscriptFileInfo = { path: join(dir.root, 'later.jsonl'), mtimeMs: 1, size: 1 }
    const cache = createSessionSummaryCache()
    expect((await cache.read(missing)).ok).toBe(false)

    dir.write('later.jsonl', buildJsonlText([buildAiTitleRecord('Arrived late')]))
    const result = await cache.read(missing)

    expect(expectTitle(result)).toBe('Arrived late')
  })
})
