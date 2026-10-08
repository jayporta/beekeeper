import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSessionScanDir, type SessionScanDir } from '../../../core/session/testSessionDir'
import { ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import { toSessionId } from '../../../core/transcript/ids'
import { statTranscriptFile } from '../../../core/transcript/statTranscriptFile'
import { buildAssistantRecord, buildJsonlText } from '../../../core/transcript/testFixtures'
import type { SessionFilesKeyOptions } from '../../ipc/sessionFilesKey'
import { createScanScheduler } from '../../ipc/scanScheduler'
import { createDailyUsageCache } from '../dailyUsageCache'
import { createDayKeyOf } from '../localDayKey'
import { readSessionDailyUsage } from '../readSessionDailyUsage'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

type Deps = Parameters<typeof readSessionDailyUsage>[1]

/** Deps for a time zone, with a scheduler that records the keys it is asked to run. */
function spyingDeps(timeZone = 'UTC'): { deps: Deps; scanKeys: string[] } {
  const dailyUsageScans = createScanScheduler({ maxConcurrent: 1 })
  const scanKeys: string[] = []
  return {
    scanKeys,
    deps: {
      timeZone,
      dayKeyOf: createDayKeyOf(timeZone),
      dailyUsageCache: createDailyUsageCache(),
      dailyUsageScans: {
        run: <T>(key: string, task: () => Promise<T>): Promise<T> => {
          scanKeys.push(key)
          return dailyUsageScans.run(key, task)
        }
      }
    }
  }
}

async function located(leadContent: string): Promise<SessionFilesKeyOptions> {
  const leadPath = dir.writeLead(leadContent)
  const transcript = await statTranscriptFile(leadPath)
  if (transcript === null) throw new Error('expected a transcript')
  const session: SessionEntry = {
    sessionId: toSessionId('1a1a1a1a-1111-4111-8111-11111111111b'),
    sessionDir: '/unused',
    transcript: ok(transcript),
    subagents: ok([])
  }
  return { projectDirName: '-p', session, transcript }
}

const lead = (timestamp: string): string =>
  buildJsonlText([buildAssistantRecord({ messageId: 'msg_1', timestamp })])

describe('readSessionDailyUsage', () => {
  it('buckets the session by the injected time zone', async () => {
    const { deps } = spyingDeps('America/Los_Angeles')

    const result = await readSessionDailyUsage(await located(lead('2026-03-01T02:00:00Z')), deps)

    expect(result).toMatchObject({ ok: true, value: { buckets: [{ day: '2026-02-28' }] } })
  })

  it('reads once through the daily usage scheduler, and serves the second read from the cache', async () => {
    const { deps, scanKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))

    const first = await readSessionDailyUsage(session, deps)
    const second = await readSessionDailyUsage(session, deps)

    expect(scanKeys).toHaveLength(1)
    expect(second).toEqual(first)
  })

  it('reads again when the time zone differs', async () => {
    const { deps, scanKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(session, deps)

    await readSessionDailyUsage(session, {
      ...deps,
      timeZone: 'Asia/Kolkata',
      dayKeyOf: createDayKeyOf('Asia/Kolkata')
    })

    expect(scanKeys).toHaveLength(2)
  })

  it('returns the unreadable code of a lead transcript that cannot be read, and does not cache it', async () => {
    const { deps, scanKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    dir.cleanup()

    const first = await readSessionDailyUsage(session, deps)
    await readSessionDailyUsage(session, deps)

    expect(first).toEqual({ ok: false, error: { reason: 'unreadable', code: 'ENOENT' } })
    expect(scanKeys).toHaveLength(2)
  })

  it('takes no slot from the summaries scheduler, so a full one does not hold it up', async () => {
    const summaries = createScanScheduler({ maxConcurrent: 1 })
    let release = (): void => {}
    void summaries.run('held', () => new Promise<void>((resolve) => (release = resolve)))
    const { deps } = spyingDeps()

    const result = await readSessionDailyUsage(await located(lead('2026-03-01T02:00:00Z')), deps)

    expect(result.ok).toBe(true)
    release()
  })

  it('waits for a slot in the daily usage scheduler', async () => {
    const dailyUsageScans = createScanScheduler({ maxConcurrent: 1 })
    const { deps } = spyingDeps()
    const first = await located(lead('2026-03-01T02:00:00Z'))
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

  it('keeps one cache entry for a session whose files keep changing', async () => {
    const { deps, scanKeys } = spyingDeps()
    const first = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(first, deps)

    const written = await located(lead('2026-03-02T02:00:00Z') + lead('2026-03-03T02:00:00Z'))
    const second = await readSessionDailyUsage(written, deps)

    expect(scanKeys).toHaveLength(2)
    expect(deps.dailyUsageCache.size).toBe(1)
    expect(second).toMatchObject({ ok: true, value: { buckets: [{ day: '2026-03-02' }] } })
  })

  it('serves the unchanged session again from its one entry', async () => {
    const { deps, scanKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(session, deps)

    await readSessionDailyUsage(session, deps)

    expect(scanKeys).toHaveLength(1)
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
