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
import { readSessionDailyUsage } from '../readSessionDailyUsage'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

/** Deps whose background lane records the keys it is asked to run. */
type Deps = Parameters<typeof readSessionDailyUsage>[1]

function spyingDeps(timeZone = 'UTC'): { deps: Deps; backgroundKeys: string[] } {
  const summaries = createScanScheduler({ maxConcurrent: 2 })
  const backgroundKeys: string[] = []
  return {
    backgroundKeys,
    deps: {
      timeZone: () => timeZone,
      dailyUsageCache: createDailyUsageCache(),
      summaries: {
        run: summaries.run,
        runInBackground: <T>(key: string, task: () => Promise<T>): Promise<T> => {
          backgroundKeys.push(key)
          return summaries.runInBackground(key, task)
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

  it('reads in the background lane, once, and serves the second read from the cache', async () => {
    const { deps, backgroundKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))

    const first = await readSessionDailyUsage(session, deps)
    const second = await readSessionDailyUsage(session, deps)

    expect(backgroundKeys).toHaveLength(1)
    expect(second).toEqual(first)
  })

  it('reads again when the time zone differs', async () => {
    const { deps, backgroundKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    await readSessionDailyUsage(session, deps)

    await readSessionDailyUsage(session, { ...deps, timeZone: () => 'Asia/Kolkata' })

    expect(backgroundKeys).toHaveLength(2)
  })

  it('returns the unreadable code of a lead transcript that cannot be read, and does not cache it', async () => {
    const { deps, backgroundKeys } = spyingDeps()
    const session = await located(lead('2026-03-01T02:00:00Z'))
    dir.cleanup()

    const first = await readSessionDailyUsage(session, deps)
    await readSessionDailyUsage(session, deps)

    expect(first).toEqual({ ok: false, error: { reason: 'unreadable', code: 'ENOENT' } })
    expect(backgroundKeys).toHaveLength(2)
  })
})
