import * as fs from 'node:fs'
import { chmodSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { createTranscriptDir, type TranscriptDir } from '../../transcript/summary/testTranscriptDir'
import { startsDuring } from '../../transcript/testReadStarts'
import { createAgentScanCache, type AgentScanCache } from '../agentScanCache'
import { scanSession, type SessionScan } from '../scanSession'
import {
  agentLines,
  createGrowingSession,
  firstLines,
  toolCallLines,
  type GrowingSession
} from '../testGrowingSession'

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

/**
 * The time each equivalence test gets, in milliseconds. They scan after every
 * append, which takes well under a second alone but a loaded runner can
 * stretch past the default.
 */
const EQUIVALENCE_TIMEOUT_MS = 30_000

const bytes = (text: string): number => Buffer.byteLength(text)

/** The offset just past the last newline in `text`: what a scan of it consumes. */
const consumedOffset = (text: string): number => Buffer.from(text).lastIndexOf(0x0a) + 1

/**
 * Scans the session through the cache and from scratch, checks that the two
 * agree, and reports where the cache's reads began.
 */
async function scanBoth(
  session: GrowingSession,
  cache: AgentScanCache,
  order?: readonly string[]
): Promise<{ scan: SessionScan; starts: number[] }> {
  const options = await session.scanOptions(order)
  let cached: SessionScan | undefined
  const starts = await startsDuring(async () => {
    cached = await scanSession({ ...options, cache })
  })
  if (cached === undefined) throw new Error('Expected a scan')
  expect(cached).toEqual(await scanSession(options))
  return { scan: cached, starts }
}

/** How many messages the scan credits to a subagent, which is zero for an unreadable one. */
function messagesOf(scan: SessionScan, agentId: string): number {
  const report = scan.subagents.get(toAgentId(agentId))
  return report?.ok === true ? report.value.usage.messageCount : 0
}

function newSession(leadScript: string, seed = 1, maxStep = 1): GrowingSession {
  return createGrowingSession({ root: dir.root, leadScript, seed, maxStep })
}

describe('scanSession resumed from cached transcript scans', () => {
  describe('equals a full scan', { timeout: EQUIVALENCE_TIMEOUT_MS }, () => {
    it('when the lead grows after the subagents, taking back what they claimed', async () => {
      const lead = agentLines('lead', [0, 40])
      const leadEarly = agentLines('lead', [0, 30])
      const session = newSession(lead)
      // `a` holds a copy of early lead history, and of lead steps the lead has not written yet.
      const a = session.addSubagent(
        'a',
        agentLines('lead', [0, 10]) + agentLines('a', [0, 10]) + agentLines('lead', [30, 35])
      )
      const b = session.addSubagent('b', agentLines('lead', [0, 5]) + agentLines('b', [0, 10]))
      session.lead.growTo(bytes(leadEarly))
      a.growTo(Number.MAX_SAFE_INTEGER)
      b.growTo(Number.MAX_SAFE_INTEGER)
      const cache = createAgentScanCache()
      const before = await scanBoth(session, cache)

      session.lead.growTo(bytes(lead))
      const after = await scanBoth(session, cache)

      expect(after.starts).toEqual([consumedOffset(leadEarly)])
      expect(messagesOf(after.scan, 'a')).toBeLessThan(messagesOf(before.scan, 'a'))
    })

    it('when a subagent listed first grows after one listed later, taking back what it claimed', async () => {
      const common = agentLines('common', [0, 6])
      const ownA = agentLines('a', [0, 8])
      const session = newSession(agentLines('lead', [0, 10]))
      const a = session.addSubagent('a', ownA + common)
      const b = session.addSubagent('b', agentLines('b', [0, 8]) + common)
      session.lead.growTo(Number.MAX_SAFE_INTEGER)
      a.growTo(bytes(ownA))
      b.growTo(Number.MAX_SAFE_INTEGER)
      const cache = createAgentScanCache()
      const before = await scanBoth(session, cache)

      a.growTo(Number.MAX_SAFE_INTEGER)
      const after = await scanBoth(session, cache)

      expect(after.starts).toEqual([consumedOffset(ownA)])
      expect(messagesOf(after.scan, 'b')).toBeLessThan(messagesOf(before.scan, 'b'))
    })

    it('when a subagent appears ahead of one that holds the same history', async () => {
      const common = agentLines('common', [0, 6])
      const session = newSession(agentLines('lead', [0, 10]))
      const a = session.addSubagent('a', agentLines('a', [0, 8]))
      const b = session.addSubagent('b', agentLines('b', [0, 8]) + common)
      const c = session.addSubagent('c', common + agentLines('c', [0, 8]))
      for (const transcript of [session.lead, a, b, c]) transcript.growTo(Number.MAX_SAFE_INTEGER)
      const cache = createAgentScanCache()
      const before = await scanBoth(session, cache, ['a', 'b'])

      const after = await scanBoth(session, cache, ['a', 'c', 'b'])

      expect(after.starts).toEqual([0])
      expect(messagesOf(after.scan, 'b')).toBeLessThan(messagesOf(before.scan, 'b'))
    })

    it.skipIf(process.getuid?.() === 0)(
      'when a subagent becomes unreadable and then readable again',
      async () => {
        const session = newSession(agentLines('lead', [0, 10]))
        const a = session.addSubagent('a', agentLines('a', [0, 8]))
        const b = session.addSubagent('b', agentLines('b', [0, 20]))
        session.lead.growTo(Number.MAX_SAFE_INTEGER)
        a.growTo(Number.MAX_SAFE_INTEGER)
        b.growTo(bytes(agentLines('b', [0, 8])))
        const cache = createAgentScanCache()
        await scanBoth(session, cache)

        try {
          b.growTo(bytes(agentLines('b', [0, 14])))
          chmodSync(b.path, 0o000)
          const unreadable = await scanBoth(session, cache)
          expect(unreadable.scan.subagents.get(toAgentId('b'))?.ok).toBe(false)
        } finally {
          chmodSync(b.path, 0o644)
        }

        b.growTo(Number.MAX_SAFE_INTEGER)
        const readable = await scanBoth(session, cache)

        expect(readable.scan.subagents.get(toAgentId('b'))?.ok).toBe(true)
        expect(readable.starts).toEqual([0])
      }
    )

    it('when a lead line pushes the session past its signal cap during a resume', async () => {
      // Three thousand one hundred tool calls in the lead, and four subagents of
      // three thousand three hundred: 16,300 events, under the cap of 16,384.
      const lead = toolCallLines('lead', [0, 34])
      const leadBefore = toolCallLines('lead', [0, 31])
      const session = newSession(lead)
      const tags = ['a', 'b', 'c', 'd']
      for (const tag of tags) session.addSubagent(tag, toolCallLines(tag, [0, 33])).growTo(Infinity)
      session.lead.growTo(bytes(leadBefore))
      const cache = createAgentScanCache()
      const before = await scanBoth(session, cache)

      session.lead.growTo(bytes(lead))
      const after = await scanBoth(session, cache)

      const partial = (scan: SessionScan): boolean[] =>
        tags.map((tag) => {
          const report = scan.subagents.get(toAgentId(tag))
          return report?.ok === true && report.value.signals.partial
        })
      expect(partial(before.scan)).toEqual([false, false, false, false])
      expect(partial(after.scan)).toEqual([false, false, false, true])
      expect(after.starts).toEqual([consumedOffset(leadBefore)])
    })

    describe('after every random-sized append to any transcript', () => {
      /** A small seeded generator (mulberry32) returning numbers in `[0, 1)`. */
      function seeded(seed: number): () => number {
        let state = seed >>> 0
        return () => {
          state = (state + 0x6d2b79f5) >>> 0
          let t = state
          t = Math.imul(t ^ (t >>> 15), t | 1)
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
      }

      it.each([1, 2, 3])('for seed %i', async (seed) => {
        const common = agentLines('common', [0, 5])
        const lead = agentLines('lead', [0, 30])
        const session = newSession(lead, seed, 700)
        const subagents = [
          session.addSubagent(
            'a',
            firstLines(lead, 12) + agentLines('a', [0, 8]) + agentLines('lead', [24, 28])
          ),
          session.addSubagent('b', agentLines('b', [0, 8]) + common),
          session.addSubagent('c', common + firstLines(lead, 6) + agentLines('c', [0, 8]))
        ]
        const remaining = [session.lead, ...subagents]
        const random = seeded(seed)
        const cache = createAgentScanCache()
        const allStarts: number[] = []

        while (remaining.length > 0) {
          const index = Math.floor(random() * remaining.length)
          if (remaining[index]?.grow() !== true) {
            remaining.splice(index, 1)
            continue
          }
          allStarts.push(...(await scanBoth(session, cache)).starts)
        }

        expect(allStarts.some((start) => start > 0)).toBe(true)
      })
    })
  })
})
