import * as fs from 'node:fs'
import { appendFileSync, renameSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feedLineScan } from '../../transcript/feedLineScan'
import {
  RESUME_RECENT_MS,
  resumableScanWeight,
  startScan,
  type ScanReadTuning
} from '../../transcript/resumableScan'
import type { TranscriptFileInfo } from '../../transcript/statTranscriptFile'
import { subagentIdentity, leadIdentity } from '../agentIdentity'
import { toAgentId } from '../../transcript/ids'
import { createTranscriptDir, type TranscriptDir } from '../../transcript/summary/testTranscriptDir'
import {
  buildTrickyTranscript,
  TRICKY_MAX_LINE_CHARS
} from '../../transcript/summary/testTrickyTranscript'
import {
  createGrowingTranscript,
  type GrowingTranscript
} from '../../transcript/testGrowingTranscript'
import { consumedOffset, startsDuring } from '../../transcript/testReadStarts'
import { statWrittenTranscript } from '../../transcript/testStatTranscript'
import { createAgentScan, type AgentScanSnapshot } from '../agentScan'
import { createAgentScanCache, type AgentScanCache } from '../agentScanCache'
import { idleSeconds, LATER_SECONDS, touchFile } from '../../transcript/testFileTimes'

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

const TUNING: ScanReadTuning = { maxLineChars: TRICKY_MAX_LINE_CHARS }

/** What a scan of the whole file, from its first byte, shows. */
async function freshSnapshot(path: string): Promise<AgentScanSnapshot> {
  const scan = createAgentScan({ identity: leadIdentity, trackCostState: true })
  await feedLineScan(scan, { ...TUNING, filePath: path })
  return scan.snapshot()
}

function readLead(cache: AgentScanCache, file: TranscriptFileInfo): Promise<AgentScanSnapshot> {
  return cache.read({ file, identity: leadIdentity, trackCostState: true, tuning: TUNING })
}

/** Reads through the cache, checks the snapshot against a fresh scan, and returns where the cache's read began (-1 for none). */
async function readAndCompare(cache: AgentScanCache, file: TranscriptFileInfo): Promise<number> {
  let snapshot: AgentScanSnapshot | undefined
  const starts = await startsDuring(async () => {
    snapshot = await readLead(cache, file)
  })
  expect(snapshot).toEqual(await freshSnapshot(file.path))
  return starts[0] ?? -1
}

function growingFrom(script: Buffer, name = 'session.jsonl'): GrowingTranscript {
  return createGrowingTranscript({ path: join(dir.root, name), script, seed: 1, maxStep: 1 })
}

describe('createAgentScanCache', () => {
  it('reads a transcript it has not seen from its first byte', async () => {
    const growing = growingFrom(buildTrickyTranscript())
    growing.growTo(3000)

    expect(await readAndCompare(createAgentScanCache(), await growing.stat())).toBe(0)
  })

  it('serves an unchanged transcript without reading it again', async () => {
    const growing = growingFrom(buildTrickyTranscript())
    growing.growTo(3000)
    const cache = createAgentScanCache()
    const file = await growing.stat()
    await readLead(cache, file)

    const starts = await startsDuring(() => readLead(cache, file))

    expect(starts).toEqual([])
    expect(await readLead(cache, file)).toEqual(await freshSnapshot(file.path))
  })

  it('resumes a grown transcript from the offset it consumed', async () => {
    const script = buildTrickyTranscript()
    const growing = growingFrom(script)
    const cache = createAgentScanCache()
    growing.growTo(2000)
    await readAndCompare(cache, await growing.stat())

    growing.growTo(6000)

    expect(await readAndCompare(cache, await growing.stat())).toBe(
      consumedOffset(script.subarray(0, 2000))
    )
  })

  it('leaves a snapshot it returned unchanged by a later read that resumes the scan', async () => {
    const growing = growingFrom(buildTrickyTranscript())
    const cache = createAgentScanCache()
    growing.growTo(2000)
    const earlier = await readLead(cache, await growing.stat())
    const copy = structuredClone(earlier)

    growing.growTo(8000)
    await readLead(cache, await growing.stat())

    expect(earlier).toEqual(copy)
  })

  it('returns the same snapshot for an unchanged transcript while another one grows', async () => {
    const script = buildTrickyTranscript()
    const unchanged = growingFrom(script, 'unchanged.jsonl')
    const growing = growingFrom(script, 'growing.jsonl')
    const cache = createAgentScanCache()
    unchanged.growTo(3000)
    growing.growTo(2000)
    const unchangedFile = await unchanged.stat()
    const first = await readLead(cache, unchangedFile)
    await readLead(cache, await growing.stat())

    growing.growTo(6000)
    await readLead(cache, await growing.stat())

    expect(await readLead(cache, unchangedFile)).toBe(first)
  })

  it('returns a new snapshot once the transcript grew', async () => {
    const growing = growingFrom(buildTrickyTranscript())
    const cache = createAgentScanCache()
    growing.growTo(2000)
    const first = await readLead(cache, await growing.stat())

    growing.growTo(6000)

    expect(await readLead(cache, await growing.stat())).not.toBe(first)
  })

  describe('rescans in full', () => {
    it('when the transcript shrank', async () => {
      const growing = growingFrom(buildTrickyTranscript())
      const cache = createAgentScanCache()
      growing.growTo(6000)
      await readLead(cache, await growing.stat())

      truncateSync(growing.path, 1500)
      touchFile(growing.path, LATER_SECONDS)

      expect(await readAndCompare(cache, await statWrittenTranscript(growing.path))).toBe(0)
    })

    it('when another file took its place', async () => {
      const script = buildTrickyTranscript()
      const growing = growingFrom(script)
      const cache = createAgentScanCache()
      growing.growTo(6000)
      await readLead(cache, await growing.stat())

      const replacement = join(dir.root, 'replacement.jsonl')
      writeFileSync(replacement, Buffer.concat([script, Buffer.from('{"a":1}\n')]))
      touchFile(replacement, LATER_SECONDS)
      renameSync(replacement, growing.path)

      expect(await readAndCompare(cache, await statWrittenTranscript(growing.path))).toBe(0)
    })

    it('when the transcript grew but its modification time did not change', async () => {
      const growing = growingFrom(buildTrickyTranscript())
      const cache = createAgentScanCache()
      growing.growTo(6000)
      const before = await growing.stat()
      await readLead(cache, before)

      appendFileSync(growing.path, '{"type":"ai-title","aiTitle":"More"}\n')
      touchFile(growing.path, before.mtimeMs / 1000)

      expect(await readAndCompare(cache, await statWrittenTranscript(growing.path))).toBe(0)
    })
  })

  describe('after a failure', () => {
    it('rejects with the system error when the transcript is gone, and scans anew once it is back', async () => {
      const script = buildTrickyTranscript()
      const growing = growingFrom(script)
      const cache = createAgentScanCache()
      growing.growTo(2000)
      const file = await growing.stat()
      await readLead(cache, file)

      rmSync(growing.path)
      await expect(
        readLead(cache, { ...file, size: file.size + 1, mtimeMs: 1 })
      ).rejects.toMatchObject({
        code: 'ENOENT'
      })

      writeFileSync(growing.path, script)
      expect(await readAndCompare(cache, await statWrittenTranscript(growing.path))).toBe(0)
    })

    it('rescans in full after a read failed partway through the new lines', async () => {
      const script = buildTrickyTranscript()
      const growing = growingFrom(script)
      const cache = createAgentScanCache()
      growing.growTo(300)
      await readLead(cache, await growing.stat())
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

      await expect(readLead(cache, grown)).rejects.toMatchObject({ code: 'EIO' })
      expect(await readAndCompare(cache, grown)).toBe(0)
    })
  })

  describe('keeps scans apart', () => {
    it('for transcripts at different paths', async () => {
      const script = buildTrickyTranscript()
      const one = growingFrom(script, 'one.jsonl')
      const two = growingFrom(script, 'two.jsonl')
      const cache = createAgentScanCache()
      one.growTo(2000)
      two.growTo(4000)
      await readLead(cache, await one.stat())
      await readLead(cache, await two.stat())
      one.growTo(5000)
      two.growTo(6000)

      expect(await readAndCompare(cache, await one.stat())).toBe(
        consumedOffset(script.subarray(0, 2000))
      )
      expect(await readAndCompare(cache, await two.stat())).toBe(
        consumedOffset(script.subarray(0, 4000))
      )
    })

    it('for one path read as two different agents', async () => {
      const growing = growingFrom(buildTrickyTranscript())
      const cache = createAgentScanCache()
      growing.growTo(2000)
      await readLead(cache, await growing.stat())
      growing.growTo(6000)
      const file = await growing.stat()

      const starts = await startsDuring(() =>
        cache.read({
          file,
          identity: subagentIdentity(toAgentId('a1')),
          trackCostState: false,
          tuning: TUNING
        })
      )

      expect(starts).toEqual([0])
    })
  })

  describe('keeps the scan of a recently modified transcript only', () => {
    /** A clock far enough on that no transcript the test writes counts as recently modified. */
    const LATER_THAN_RECENT = (): number => Date.now() + 2 * RESUME_RECENT_MS

    it('keeps none for a transcript modified longer ago than the recent window', async () => {
      const growing = growingFrom(buildTrickyTranscript())
      const cache = createAgentScanCache({ now: LATER_THAN_RECENT })
      growing.growTo(2000)
      await readLead(cache, await growing.stat())
      growing.growTo(6000)

      expect(await readAndCompare(cache, await growing.stat())).toBe(0)
    })

    it('still returns what a full scan shows for such a transcript', async () => {
      const growing = growingFrom(buildTrickyTranscript())
      const cache = createAgentScanCache({ now: LATER_THAN_RECENT })
      growing.growTo(6000)
      const file = await growing.stat()

      expect(await readLead(cache, file)).toEqual(await freshSnapshot(file.path))
    })

    it('resumes a transcript modified within the recent window', async () => {
      const script = buildTrickyTranscript()
      const growing = growingFrom(script)
      const cache = createAgentScanCache({ now: () => Date.now() + RESUME_RECENT_MS - 60_000 })
      growing.growTo(2000)
      await readLead(cache, await growing.stat())
      growing.growTo(6000)

      expect(await readAndCompare(cache, await growing.stat())).toBe(
        consumedOffset(script.subarray(0, 2000))
      )
    })
  })

  describe('keeps scans while the session or the transcript is recent', () => {
    /** Writes a transcript to `bytes` bytes and dates it an hour ago. */
    async function idleTranscript(name: string, bytes: number): Promise<GrowingTranscript> {
      const growing = growingFrom(buildTrickyTranscript(), name)
      growing.growTo(bytes)
      touchFile(growing.path, idleSeconds())
      return growing
    }

    /** Grows an idle transcript and dates it an hour ago again, one second off, so the stat differs. */
    async function growIdle(growing: GrowingTranscript, bytes: number): Promise<void> {
      growing.growTo(bytes)
      touchFile(growing.path, idleSeconds() - 1)
    }

    function readUnder(
      cache: AgentScanCache,
      file: TranscriptFileInfo,
      sessionLead: TranscriptFileInfo
    ): Promise<AgentScanSnapshot> {
      return cache.read({
        file,
        identity: leadIdentity,
        trackCostState: true,
        tuning: TUNING,
        sessionLead
      })
    }

    it('keeps the scan of a transcript that is idle on its own while the session lead is recent', async () => {
      const script = buildTrickyTranscript()
      const recentLead = growingFrom(script, 'lead.jsonl')
      recentLead.growTo(1000)
      const idle = await idleTranscript('idle.jsonl', 2000)
      const cache = createAgentScanCache()
      await readUnder(cache, await idle.stat(), await recentLead.stat())
      await growIdle(idle, 6000)

      const starts = await startsDuring(async () =>
        readUnder(cache, await idle.stat(), await recentLead.stat())
      )

      expect(starts).toEqual([consumedOffset(script.subarray(0, 2000))])
    })

    it('keeps the scan of a transcript that is recent itself while the session lead is idle', async () => {
      const script = buildTrickyTranscript()
      const idleLead = await idleTranscript('lead.jsonl', 1000)
      const recent = growingFrom(script, 'recent.jsonl')
      const cache = createAgentScanCache()
      recent.growTo(2000)
      await readUnder(cache, await recent.stat(), await idleLead.stat())
      recent.growTo(6000)

      const starts = await startsDuring(async () =>
        readUnder(cache, await recent.stat(), await idleLead.stat())
      )

      expect(starts).toEqual([consumedOffset(script.subarray(0, 2000))])
    })

    it('keeps nothing for a transcript when it and the session lead are both idle', async () => {
      const idleLead = await idleTranscript('lead.jsonl', 1000)
      const idle = await idleTranscript('idle.jsonl', 2000)
      const cache = createAgentScanCache()
      await readUnder(cache, await idle.stat(), await idleLead.stat())
      await growIdle(idle, 6000)

      const starts = await startsDuring(async () =>
        readUnder(cache, await idle.stat(), await idleLead.stat())
      )

      expect(starts).toEqual([0])
    })

    it('judges a transcript by its own recency when no session lead is given', async () => {
      const idle = await idleTranscript('idle.jsonl', 2000)
      const cache = createAgentScanCache()
      await readLead(cache, await idle.stat())
      await growIdle(idle, 6000)

      expect(await readAndCompare(cache, await idle.stat())).toBe(0)
    })
  })

  describe('bounds the scans it keeps', () => {
    it('keeps none when a scan is heavier than the whole bound, but still reads', async () => {
      const growing = growingFrom(buildTrickyTranscript())
      const cache = createAgentScanCache({ maxWeight: 100 })
      growing.growTo(2000)
      await readLead(cache, await growing.stat())
      growing.growTo(6000)

      expect(await readAndCompare(cache, await growing.stat())).toBe(0)
    })

    /** Five transcripts of the same script, written to 1500 bytes and stat'd. */
    async function fiveFiles(): Promise<TranscriptFileInfo[]> {
      const script = buildTrickyTranscript()
      const files: TranscriptFileInfo[] = []
      for (const name of ['a', 'b', 'c', 'd', 'e']) {
        const growing = growingFrom(script, `${name}.jsonl`)
        growing.growTo(1500)
        files.push(await growing.stat())
      }
      return files
    }

    /** What one of these scans weighs once stored. */
    async function weightOfOne(file: TranscriptFileInfo): Promise<number> {
      return resumableScanWeight(
        await startScan({
          file,
          scan: createAgentScan({ identity: leadIdentity, trackCostState: true }),
          tuning: TUNING
        })
      )
    }

    it('evicts the scan read least recently first', async () => {
      const files = await fiveFiles()
      // A scan is kept only up to a quarter of the bound, so this bound keeps four scans, not five.
      const cache = createAgentScanCache({
        maxWeight: 4 * (await weightOfOne(files[0] as TranscriptFileInfo)) + 100
      })
      for (const file of files) await readLead(cache, file)

      const starts: number[][] = []
      for (const file of [...files].reverse()) {
        starts.push(await startsDuring(() => readLead(cache, file)))
      }

      expect(starts).toEqual([[], [], [], [], [0]])
    })

    it('keeps none for a scan weighing more than a quarter of the bound, though it would fit', async () => {
      const [file] = await fiveFiles()
      const cache = createAgentScanCache({
        maxWeight: 4 * (await weightOfOne(file as TranscriptFileInfo)) - 1
      })
      await readLead(cache, file as TranscriptFileInfo)

      expect(await startsDuring(() => readLead(cache, file as TranscriptFileInfo))).toEqual([0])
    })

    it('does not evict the scans of other transcripts to keep a heavy one', async () => {
      const files = await fiveFiles()
      const lights = files.slice(0, 3)
      const growing = growingFrom(buildTrickyTranscript(), 'heavy.jsonl')
      growing.growTo(Number.MAX_SAFE_INTEGER)
      const heavy = await growing.stat()
      const cache = createAgentScanCache({
        maxWeight: 4 * (await weightOfOne(files[0] as TranscriptFileInfo)) + 100
      })
      for (const file of lights) await readLead(cache, file)

      await readLead(cache, heavy)

      for (const file of lights) {
        expect(await startsDuring(() => readLead(cache, file))).toEqual([])
      }
    })
  })

  it('shares one read between overlapping reads of a transcript', async () => {
    const script = buildTrickyTranscript()
    const growing = growingFrom(script)
    const cache = createAgentScanCache()
    growing.growTo(2000)
    await readLead(cache, await growing.stat())
    growing.growTo(4000)
    const grown = await growing.stat()

    const starts = await startsDuring(async () => {
      const results = await Promise.all([readLead(cache, grown), readLead(cache, { ...grown })])
      expect(results[1]).toEqual(results[0])
    })

    expect(starts).toEqual([consumedOffset(script.subarray(0, 2000))])
  })
})
