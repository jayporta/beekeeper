import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSessionScanDir, type SessionScanDir } from '../../../core/session/testSessionDir'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import { toSessionId } from '../../../core/transcript/ids'
import { statTranscriptFile } from '../../../core/transcript/statTranscriptFile'
import { buildAssistantRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import { createSessionSummaryCache } from '../../../core/transcript/summary/sessionSummaryCache'
import { buildSessionSummary } from '../../../core/transcript/summary/testSessionSummary'
import type { SubagentEntry } from '../../../core/transcript/discoverSubagents'
import type { SessionFilesKeyOptions } from '../../ipc/sessionFilesKey'
import { createScanScheduler } from '../../ipc/scanScheduler'
import { createDailyUsageCache } from '../dailyUsageCache'
import { createDayKeyOf } from '../localDayKey'
import { readSessionDailyUsage } from '../readSessionDailyUsage'

/** How many times the full lead and subagent scan ran. */
const fullScans = vi.hoisted(() => ({ count: 0 }))

vi.mock('../../../core/usage/scanSessionDailyUsage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/usage/scanSessionDailyUsage')>()
  return {
    ...actual,
    scanSessionDailyUsage: (options: Parameters<typeof actual.scanSessionDailyUsage>[0]) => {
      fullScans.count += 1
      return actual.scanSessionDailyUsage(options)
    }
  }
})

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
  fullScans.count = 0
})

afterEach(() => {
  dir.cleanup()
})

type Deps = Parameters<typeof readSessionDailyUsage>[1]

interface SpyingDeps {
  readonly deps: Deps
  /** The keys the daily usage scheduler was asked to run. */
  readonly scanKeys: string[]
  /** How many times the summary cache was asked to read a transcript. */
  readonly summaryReads: () => number
}

/** Deps for a time zone, recording the daily scan keys and the summary cache reads. */
function spyingDeps(timeZone = 'UTC'): SpyingDeps {
  const dailyUsageScans = createScanScheduler({ maxConcurrent: 1 })
  const summaryCache = createSessionSummaryCache()
  const scanKeys: string[] = []
  let summaryReads = 0
  return {
    scanKeys,
    summaryReads: () => summaryReads,
    deps: {
      timeZone,
      dayKeyOf: createDayKeyOf(timeZone),
      dailyUsageCache: createDailyUsageCache(),
      dailyUsageScans: {
        run: <T>(key: string, task: () => Promise<T>): Promise<T> => {
          scanKeys.push(key)
          return dailyUsageScans.run(key, task)
        }
      },
      summaries: createScanScheduler({ maxConcurrent: 2 }),
      summaryCache: {
        read: (file) => {
          summaryReads += 1
          return summaryCache.read(file)
        }
      }
    }
  }
}

interface LocatedOptions {
  readonly subagents?: SessionEntry['subagents']
}

async function located(
  leadContent: string,
  options: LocatedOptions = {}
): Promise<SessionFilesKeyOptions> {
  const leadPath = dir.writeLead(leadContent)
  const transcript = await statTranscriptFile(leadPath)
  if (transcript === null) throw new Error('expected a transcript')
  const session: SessionEntry = {
    sessionId: toSessionId('1a1a1a1a-1111-4111-8111-11111111111b'),
    sessionDir: '/unused',
    transcript: ok(transcript),
    subagents: options.subagents ?? ok([])
  }
  return { projectDirName: '-p', session, transcript }
}

const lead = (timestamp: string): string =>
  buildJsonlText([buildAssistantRecord({ messageId: 'msg_1', timestamp })])

function subagentWith(
  agentId: string,
  records: Parameters<typeof buildAssistantRecord>[0][]
): SubagentEntry {
  return dir.addSubagent(agentId, { transcript: buildJsonlText(records.map(buildAssistantRecord)) })
}

describe('readSessionDailyUsage', () => {
  it('buckets the session by the injected time zone', async () => {
    const { deps } = spyingDeps('America/Los_Angeles')

    const result = await readSessionDailyUsage(await located(lead('2026-03-01T02:00:00Z')), deps)

    expect(result).toMatchObject({ ok: true, value: { buckets: [{ day: '2026-02-28' }] } })
  })

  it('reads the lead once, schedules no daily scan for a lead alone, and serves the second read from the cache', async () => {
    const { deps, scanKeys, summaryReads } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))

    const first = await readSessionDailyUsage(session, deps)
    const second = await readSessionDailyUsage(session, deps)

    expect(summaryReads()).toBe(1)
    expect(scanKeys).toEqual([])
    expect(second).toEqual(first)
  })

  it('does not read the lead file when the summary cache already holds it', async () => {
    const { deps } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await deps.summaryCache.read(session.transcript)
    dir.cleanup()

    const result = await readSessionDailyUsage(session, deps)

    expect(result).toMatchObject({ ok: true, value: { buckets: [{ day: '2026-03-01' }] } })
  })

  it('combines the lead with a subagent read through the daily usage scheduler', async () => {
    const { deps, scanKeys } = spyingDeps()
    const subagent = subagentWith('a1', [
      { messageId: 'sub_1', inputTokens: 4, outputTokens: 0, timestamp: '2026-03-02T12:00:00Z' }
    ])
    const session = await located(lead('2026-03-01T02:00:00Z'), { subagents: ok([subagent]) })

    const result = await readSessionDailyUsage(session, deps)

    expect(scanKeys).toHaveLength(1)
    expect(fullScans.count).toBe(0)
    expect(result).toMatchObject({
      ok: true,
      value: {
        buckets: [
          { day: '2026-03-01', tokens: 15 },
          { day: '2026-03-02', tokens: 4 }
        ]
      }
    })
  })

  it('counts a message a subagent repeats from the lead once', async () => {
    const { deps } = spyingDeps()
    const subagent = subagentWith('a1', [{ messageId: 'msg_1', timestamp: '2026-03-05T02:00:00Z' }])
    const session = await located(lead('2026-03-01T02:00:00Z'), { subagents: ok([subagent]) })

    const result = await readSessionDailyUsage(session, deps)

    expect(result).toMatchObject({
      ok: true,
      value: { buckets: [{ day: '2026-03-01', tokens: 15 }] }
    })
  })

  it('takes the full scan when the lead summary has no lead usage', async () => {
    const { deps, scanKeys } = spyingDeps()
    const past = {
      ...deps,
      summaryCache: { read: async () => ok(buildSessionSummary({ leadUsage: null })) }
    }
    const subagent = subagentWith('a1', [
      { messageId: 'sub_1', inputTokens: 4, outputTokens: 0, timestamp: '2026-03-02T12:00:00Z' }
    ])
    const session = await located(lead('2026-03-01T02:00:00Z'), { subagents: ok([subagent]) })

    const result = await readSessionDailyUsage(session, past)

    expect(scanKeys).toHaveLength(1)
    expect(fullScans.count).toBe(1)
    expect(result).toMatchObject({
      ok: true,
      value: {
        buckets: [
          { day: '2026-03-01', tokens: 15 },
          { day: '2026-03-02', tokens: 4 }
        ]
      }
    })
  })

  it('reads again when the time zone differs', async () => {
    const { deps, summaryReads } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(session, deps)

    await readSessionDailyUsage(session, {
      ...deps,
      timeZone: 'Asia/Kolkata',
      dayKeyOf: createDayKeyOf('Asia/Kolkata')
    })

    expect(summaryReads()).toBe(2)
  })

  it('returns the unreadable code of a lead transcript that cannot be read, and does not cache it', async () => {
    const { deps, summaryReads } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    dir.cleanup()

    const first = await readSessionDailyUsage(session, deps)
    await readSessionDailyUsage(session, deps)

    expect(first).toEqual({ ok: false, error: { reason: 'unreadable', code: 'ENOENT' } })
    expect(summaryReads()).toBe(2)
    expect(deps.dailyUsageCache.size).toBe(0)
  })

  it('counts the lead and does not cache the result when the subagents could not be listed', async () => {
    const { deps, summaryReads } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'), {
      subagents: err({ reason: 'unreadable', code: 'EACCES' })
    })

    const first = await readSessionDailyUsage(session, deps)
    await readSessionDailyUsage(session, deps)

    expect(first).toMatchObject({
      ok: true,
      value: { buckets: [{ day: '2026-03-01', tokens: 15 }] }
    })
    expect(deps.dailyUsageCache.size).toBe(0)
    expect(summaryReads()).toBe(2)
  })

  it('reads the lead in the background lane, so a foreground summary read queued after it goes first', async () => {
    const summaries = createScanScheduler({ maxConcurrent: 1 })
    let release = (): void => {}
    void summaries.run('held', () => new Promise<void>((resolve) => (release = resolve)))
    const { deps } = spyingDeps()
    const order: string[] = []
    const session = await located(lead('2026-03-01T02:00:00Z'))

    const pending = readSessionDailyUsage(session, {
      ...deps,
      summaries,
      summaryCache: {
        read: (file) => {
          order.push('chart lead')
          return deps.summaryCache.read(file)
        }
      }
    })
    const foreground = summaries.run('later', async () => {
      order.push('foreground')
    })
    release()
    await Promise.all([pending, foreground])

    expect(order).toEqual(['foreground', 'chart lead'])
  })

  it('waits for a slot in the daily usage scheduler to read its subagents', async () => {
    const dailyUsageScans = createScanScheduler({ maxConcurrent: 1 })
    const { deps } = spyingDeps()
    const subagent = subagentWith('a1', [{ messageId: 'sub_1' }])
    const first = await located(lead('2026-03-01T02:00:00Z'), { subagents: ok([subagent]) })
    let release = (): void => {}
    void dailyUsageScans.run('other', () => new Promise<void>((resolve) => (release = resolve)))
    let finished = false

    const pending = readSessionDailyUsage(first, { ...deps, dailyUsageScans }).then(() => {
      finished = true
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(finished).toBe(false)
    release()
    await pending

    expect(finished).toBe(true)
  })

  it('reads the lead of a session with subagents only once its daily scan has a slot, so a queued session holds no lead usage', async () => {
    const dailyUsageScans = createScanScheduler({ maxConcurrent: 1 })
    const { deps, summaryReads } = spyingDeps()
    const subagent = subagentWith('a1', [{ messageId: 'sub_1' }])
    const session = await located(lead('2026-03-01T02:00:00Z'), { subagents: ok([subagent]) })
    let release = (): void => {}
    void dailyUsageScans.run('other', () => new Promise<void>((resolve) => (release = resolve)))

    const pending = readSessionDailyUsage(session, { ...deps, dailyUsageScans })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(summaryReads()).toBe(0)
    release()
    await pending

    expect(summaryReads()).toBe(1)
  })

  it('keeps one cache entry for a session whose files keep changing', async () => {
    const { deps, summaryReads } = spyingDeps()
    const first = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(first, deps)

    const written = await located(lead('2026-03-02T02:00:00Z') + lead('2026-03-03T02:00:00Z'))
    const second = await readSessionDailyUsage(written, deps)

    expect(summaryReads()).toBe(2)
    expect(deps.dailyUsageCache.size).toBe(1)
    expect(second).toMatchObject({ ok: true, value: { buckets: [{ day: '2026-03-02' }] } })
  })

  it('serves the unchanged session again from its one entry', async () => {
    const { deps, summaryReads } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(session, deps)

    await readSessionDailyUsage(session, deps)

    expect(summaryReads()).toBe(1)
    expect(deps.dailyUsageCache.size).toBe(1)
  })

  it('keeps an entry for each time zone a session was read in', async () => {
    const { deps } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(session, deps)

    await readSessionDailyUsage(session, {
      ...deps,
      timeZone: 'Asia/Kolkata',
      dayKeyOf: createDayKeyOf('Asia/Kolkata')
    })

    expect(deps.dailyUsageCache.size).toBe(2)
  })
})
