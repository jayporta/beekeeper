import { chmod, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QUARTER_HOUR_MS } from '../../../core/shared/quarterHour'
import type { ProjectDailyUsageDto } from '../../../shared/ipc/projectDailyUsageDto'
import { buildAssistantRecord } from '../../../core/transcript/testFixtures'
import type { ArchivedLeadSlots } from '../../archive/archiveStoreTypes'
import { testArchivedSession } from '../../archive/testArchiveFixtures'
import { createFakeArchive } from '../../archive/testFakeArchive'
import { SKIP_UNREAD_SLACK_MS, TOTALS_WINDOW_MS } from '../../overview/totalsWindow'
import { getProjectDailyUsageHandler } from '../getProjectDailyUsageHandler'
import { getProjectTotalsHandler } from '../getProjectTotalsHandler'
import type { IpcDeps } from '../ipcDeps'
import { sessionRefKey } from '../sessionRefKey'
import { writeTranscript } from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const NOW = Date.parse('2026-03-10T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const request = { projectDirName: TEST_PROJECT, window: '7d' }
const idOf = (n: number): string => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`

afterEach(async () => {
  await chmod(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT), 0o755).catch(
    () => undefined
  )
})

interface Message {
  readonly at: string
  readonly tokens?: number
  readonly model?: string
  readonly id?: string
}

/** Writes a lead session whose file time is `mtimeMs`, holding the given messages. */
async function writeSession(
  n: number,
  messages: readonly Message[],
  mtimeMs = NOW
): Promise<string> {
  await writeTranscript(ctx.tree.home, {
    projectDirName: TEST_PROJECT,
    sessionId: idOf(n),
    records: messages.map((m, i) =>
      buildAssistantRecord({
        messageId: m.id ?? `msg_${n}_${i}`,
        timestamp: m.at,
        inputTokens: m.tokens ?? 10,
        outputTokens: 0,
        model: m.model
      })
    )
  })
  const path = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, `${idOf(n)}.jsonl`)
  await utimes(path, new Date(mtimeMs), new Date(mtimeMs))
  return path
}

async function writeSubagent(
  n: number,
  messages: readonly Message[],
  mtimeMs = NOW
): Promise<string> {
  const dir = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, idOf(n), 'subagents')
  await mkdir(dir, { recursive: true })
  const path = join(dir, 'agent-a1.jsonl')
  await writeFile(
    path,
    messages
      .map((m, i) =>
        JSON.stringify(
          buildAssistantRecord({
            messageId: m.id ?? `sub_${n}_${i}`,
            timestamp: m.at,
            inputTokens: m.tokens ?? 10,
            outputTokens: 0
          })
        )
      )
      .join('\n') + '\n'
  )
  await utimes(path, new Date(mtimeMs), new Date(mtimeMs))
  return path
}

/** Clears the tree's own session, which carries unrelated records. */
async function removeTreeSession(): Promise<void> {
  await rm(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, `${TEST_SESSION_ID}.jsonl`))
}

/** What {@link depsAt} returns. */
interface SpyingDeps {
  readonly deps: IpcDeps
  /** The keys the daily usage scheduler was asked to run. */
  readonly scanKeys: string[]
  /** How many times the time zone was read. */
  readonly zoneReads: () => number
  /**
   * How many transcript summaries were scanned. A read the cache serves, or one
   * shared with a read in flight, returns the same summary, so it isn't counted again.
   */
  readonly summaryReads: () => number
}

/**
 * `ctx.deps` with the clock stopped, a fixed zone, a daily usage scheduler
 * that records its keys, and a summary cache that counts the summaries it scans.
 */
function depsAt(timeZone = 'UTC'): SpyingDeps {
  const scanKeys: string[] = []
  let zoneReads = 0
  const scanned = new Set<object>()
  const { dailyUsageScans, summaryCache } = ctx.deps
  const deps: IpcDeps = {
    ...ctx.deps,
    now: () => NOW,
    timeZone: () => {
      zoneReads += 1
      return timeZone
    },
    dailyUsageScans: {
      run: (key, task) => {
        scanKeys.push(key)
        return dailyUsageScans.run(key, task)
      }
    },
    summaryCache: {
      read: async (file) => {
        const summary = await summaryCache.read(file)
        if (summary.ok) scanned.add(summary.value)
        return summary
      }
    }
  }
  return { deps, scanKeys, zoneReads: () => zoneReads, summaryReads: () => scanned.size }
}

type Usage = ProjectDailyUsageDto

async function usageOf(deps: IpcDeps, payload: unknown = request): Promise<Usage> {
  const result = await getProjectDailyUsageHandler(deps, payload)
  if (!result.ok) throw new Error(`expected usage, got ${result.error.code}`)
  return result.value
}

const tokensOn = (usage: Usage, day: string): number =>
  usage.days.find((d) => d.day === day)?.models.reduce((sum, m) => sum + m.tokens, 0) ?? -1

describe('getProjectDailyUsageHandler request validation', () => {
  it.each([
    ['an unknown window', { ...request, window: '1d' }],
    ['no window', { projectDirName: TEST_PROJECT }],
    ['an extra field', { ...request, path: '/etc' }],
    ['a project name that is a path', { ...request, projectDirName: '../x' }],
    ['no payload', undefined]
  ])('refuses %s, reading nothing', async (_label, payload) => {
    const { deps, scanKeys } = depsAt()

    expect(await getProjectDailyUsageHandler(deps, payload)).toEqual({
      ok: false,
      error: { code: 'invalid-request' }
    })
    expect(scanKeys).toEqual([])
  })

  it('finds no project that is not listed', async () => {
    const { deps } = depsAt()

    expect(
      await getProjectDailyUsageHandler(deps, { ...request, projectDirName: '-nope' })
    ).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})

describe('getProjectDailyUsageHandler usage', () => {
  it('reads the time zone once for the request, however many sessions it reads', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z' }])
    await writeSession(2, [{ at: '2026-03-06T10:00:00Z' }])
    await writeSession(3, [{ at: '2026-03-07T10:00:00Z' }])
    const { deps, zoneReads } = depsAt()

    await usageOf(deps)

    expect(zoneReads()).toBe(1)
  })

  it('lists every day of the window, oldest first', async () => {
    await removeTreeSession()

    const usage = await usageOf(depsAt().deps)

    expect(usage.days.map((d) => d.day)).toEqual([
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10'
    ])
  })

  it('counts messages on the first and last day, and leaves out the day before', async () => {
    await removeTreeSession()
    await writeSession(1, [
      { at: '2026-03-03T23:59:00Z', tokens: 1000 },
      { at: '2026-03-04T00:01:00Z', tokens: 20 },
      { at: '2026-03-10T11:00:00Z', tokens: 30 }
    ])

    const usage = await usageOf(depsAt().deps)

    expect(tokensOn(usage, '2026-03-04')).toBe(20)
    expect(tokensOn(usage, '2026-03-10')).toBe(30)
    expect(usage.days.reduce((sum, d) => sum + tokensOn(usage, d.day), 0)).toBe(50)
  })

  it('splits a model’s tokens by normalized model id', async () => {
    await removeTreeSession()
    await writeSession(1, [
      { at: '2026-03-05T10:00:00Z', tokens: 10, model: 'claude-opus-5-20260101' },
      { at: '2026-03-05T11:00:00Z', tokens: 5, model: 'claude-opus-5' },
      { at: '2026-03-05T12:00:00Z', tokens: 7, model: 'claude-haiku-5' }
    ])

    const usage = await usageOf(depsAt().deps)

    expect(usage.days.find((d) => d.day === '2026-03-05')?.models).toEqual([
      { model: 'claude-opus-5', tokens: 15 },
      { model: 'claude-haiku-5', tokens: 7 }
    ])
  })

  it('sums sessions, including a subagent’s tokens', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z', tokens: 10 }])
    await writeSession(2, [{ at: '2026-03-05T10:00:00Z', tokens: 4 }])
    await writeSubagent(2, [{ at: '2026-03-06T10:00:00Z', tokens: 3 }])

    const usage = await usageOf(depsAt().deps)

    expect(tokensOn(usage, '2026-03-05')).toBe(14)
    expect(tokensOn(usage, '2026-03-06')).toBe(3)
  })

  it('puts a message on the day of the injected time zone', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-10T05:00:00Z', tokens: 10 }])

    const usage = await usageOf(depsAt('America/Los_Angeles').deps)

    expect(usage.days.at(-1)?.day).toBe('2026-03-10')
    expect(tokensOn(usage, '2026-03-09')).toBe(10)
    expect(tokensOn(usage, '2026-03-10')).toBe(0)
  })

  it('gives the 30 day window thirty days, counting a message the 7 day window leaves out', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-02-20T10:00:00Z', tokens: 10 }])
    const { deps } = depsAt()

    const week = await usageOf(deps)
    const month = await usageOf(deps, { ...request, window: '30d' })

    expect(week.days).toHaveLength(7)
    expect(month.days).toHaveLength(30)
    expect(tokensOn(month, '2026-02-20')).toBe(10)
  })

  it('counts a session the lead of which was written long ago when a subagent file is recent', async () => {
    await removeTreeSession()
    const old = NOW - TOTALS_WINDOW_MS['7d'] - 3 * DAY
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z', tokens: 10 }], old)
    await writeSubagent(1, [{ at: '2026-03-06T10:00:00Z', tokens: 3 }], NOW)

    const usage = await usageOf(depsAt().deps)

    expect(tokensOn(usage, '2026-03-05')).toBe(10)
    expect(tokensOn(usage, '2026-03-06')).toBe(3)
  })
})

describe('getProjectDailyUsageHandler reading only what can count', () => {
  it('never reads a session whose files are older than the window, a day, and the slack', async () => {
    await removeTreeSession()
    const stale = NOW - TOTALS_WINDOW_MS['7d'] - DAY - SKIP_UNREAD_SLACK_MS - 1000
    await writeSession(1, [{ at: '2026-02-01T10:00:00Z' }], stale)
    await writeSubagent(1, [{ at: '2026-02-01T10:00:00Z' }], stale)
    await writeSession(2, [{ at: '2026-03-05T10:00:00Z', tokens: 8 }])
    const { deps, summaryReads } = depsAt()

    const usage = await usageOf(deps)

    expect(summaryReads()).toBe(1)
    expect(tokensOn(usage, '2026-03-05')).toBe(8)
  })
})

describe('getProjectDailyUsageHandler cache', () => {
  it('reads nothing the second time when the files are unchanged', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z', tokens: 8 }])
    await writeSubagent(1, [{ at: '2026-03-05T11:00:00Z', tokens: 2 }])
    const { deps, scanKeys, summaryReads } = depsAt()
    const first = await usageOf(deps)

    const second = await usageOf(deps)

    expect(scanKeys).toHaveLength(1)
    expect(summaryReads()).toBe(1)
    expect(second).toEqual(first)
  })

  it('reads again after a subagent file is touched', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z', tokens: 8 }])
    const subagent = await writeSubagent(1, [{ at: '2026-03-05T11:00:00Z', tokens: 2 }])
    const { deps, scanKeys } = depsAt()
    await usageOf(deps)

    await utimes(subagent, new Date(NOW - 1000), new Date(NOW - 1000))
    await usageOf(deps)

    expect(scanKeys).toHaveLength(2)
  })

  it.skipIf(process.getuid?.() === 0)(
    'reads again when a subagent could not be read the first time',
    async () => {
      await removeTreeSession()
      await writeSession(1, [{ at: '2026-03-05T10:00:00Z', tokens: 8 }])
      const subagent = await writeSubagent(1, [{ at: '2026-03-05T11:00:00Z', tokens: 2 }])
      const { deps, scanKeys } = depsAt()
      await chmod(subagent, 0o000)
      try {
        const first = await usageOf(deps)
        await usageOf(deps)

        expect(first.partial.unreadableSubagents).toBe(1)
        expect(scanKeys).toHaveLength(2)
      } finally {
        await chmod(subagent, 0o644)
      }
    }
  )
})

describe('getProjectDailyUsageHandler partial results', () => {
  it('counts a line that could not be read', async () => {
    await removeTreeSession()
    const path = await writeSession(1, [{ at: '2026-03-05T10:00:00Z' }])
    await writeFile(path, 'not json\n', { flag: 'a' })
    await utimes(path, new Date(NOW), new Date(NOW))

    const usage = await usageOf(depsAt().deps)

    expect(usage.partial).toMatchObject({ skippedLines: 1, unreadable: 0 })
  })

  it.skipIf(process.getuid?.() === 0)('counts a session whose lead cannot be read', async () => {
    await removeTreeSession()
    const path = await writeSession(1, [{ at: '2026-03-05T10:00:00Z' }])
    await chmod(path, 0o000)
    try {
      expect((await usageOf(depsAt().deps)).partial.unreadable).toBe(1)
    } finally {
      await chmod(path, 0o644)
    }
  })

  it('is all zero for a folder with no sessions', async () => {
    await removeTreeSession()

    expect((await usageOf(depsAt().deps)).partial).toEqual({
      unreadable: 0,
      skippedLines: 0,
      undated: 0,
      unreadableSubagents: 0,
      archivedWithoutSubagents: 0
    })
  })

  it('sends only the whitelisted fields', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z' }])

    const usage = await usageOf(depsAt().deps)

    expect(Object.keys(usage).sort()).toEqual(['days', 'partial'])
    expect(Object.keys(usage.days[0] ?? {}).sort()).toEqual(['day', 'models'])
    expect(Object.keys(usage.partial).sort()).toEqual([
      'archivedWithoutSubagents',
      'skippedLines',
      'undated',
      'unreadable',
      'unreadableSubagents'
    ])
  })
})

describe('getProjectDailyUsageHandler with the project totals', () => {
  it('reads each lead once when the totals and the chart are asked for together', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-05T10:00:00Z' }])
    await writeSession(2, [{ at: '2026-03-06T10:00:00Z' }])
    await writeSubagent(2, [{ at: '2026-03-06T11:00:00Z' }])
    const { deps, summaryReads, scanKeys } = depsAt()

    const [totals, usage] = await Promise.all([
      getProjectTotalsHandler(deps, request),
      getProjectDailyUsageHandler(deps, request)
    ])

    expect(totals.ok).toBe(true)
    expect(usage.ok).toBe(true)
    expect(summaryReads()).toBe(2)
    // Only the session with a subagent schedules a daily scan.
    expect(scanKeys).toHaveLength(1)
  })
})

describe('getProjectDailyUsageHandler archived sessions', () => {
  const slotAt = (
    iso: string,
    tokens: number,
    model = 'm'
  ): ArchivedLeadSlots['slots'][number] => ({
    slot: Math.floor(Date.parse(iso) / QUARTER_HOUR_MS),
    model,
    tokens
  })

  /** An archived session of the test project, last active on 2026-03-09. */
  const archived = (
    n: number,
    options: Parameters<typeof testArchivedSession>[1] = {}
  ): ReturnType<typeof testArchivedSession> =>
    testArchivedSession(idOf(n), {
      projectDirName: TEST_PROJECT,
      activity: { earliestMs: Date.parse('2026-03-08T00:00:00Z'), latestMs: NOW - DAY },
      modifiedMs: NOW - DAY,
      ...options
    })

  /** Deps with the clock stopped and an archive holding the sessions, with the slots of each by id. */
  function withArchive(
    sessions: readonly ReturnType<typeof testArchivedSession>[],
    slots: ReadonlyMap<number, ArchivedLeadSlots> = new Map(),
    timeZone = 'UTC'
  ): { deps: IpcDeps; archive: ReturnType<typeof createFakeArchive> } {
    const leadSlots = new Map(
      [...slots].map(([n, value]) => [
        sessionRefKey({ projectDirName: TEST_PROJECT, sessionId: idOf(n) }),
        value
      ])
    )
    const archive = createFakeArchive(undefined, { sessions, leadSlots })
    return { deps: { ...depsAt(timeZone).deps, archive }, archive }
  }

  const slotsOf = (...slots: ArchivedLeadSlots['slots'][number][]): ArchivedLeadSlots => ({
    slots,
    undatedMessages: 0,
    invalidAssistantRecords: 0
  })

  it('counts an archived session’s lead slots on the day each one starts', async () => {
    await removeTreeSession()
    const slots = slotsOf(slotAt('2026-03-08T10:00:00Z', 30), slotAt('2026-03-09T10:00:00Z', 70))
    const { deps } = withArchive([archived(100)], new Map([[100, slots]]))

    const usage = await usageOf(deps)

    expect([tokensOn(usage, '2026-03-08'), tokensOn(usage, '2026-03-09')]).toEqual([30, 70])
  })

  it('buckets a slot on the local day in the request’s zone, including a zone 45 minutes off the hour', async () => {
    await removeTreeSession()
    // 18:00Z is 23:45 on the 8th in Kathmandu (+05:45), and 18:15Z is its midnight.
    const slots = slotsOf(slotAt('2026-03-08T18:00:00Z', 10), slotAt('2026-03-08T18:15:00Z', 20))
    const session = archived(100)

    const utc = await usageOf(withArchive([session], new Map([[100, slots]]), 'UTC').deps)
    const kathmandu = await usageOf(
      withArchive([session], new Map([[100, slots]]), 'Asia/Kathmandu').deps
    )

    expect([tokensOn(utc, '2026-03-08'), tokensOn(utc, '2026-03-09')]).toEqual([30, 0])
    expect([tokensOn(kathmandu, '2026-03-08'), tokensOn(kathmandu, '2026-03-09')]).toEqual([10, 20])
  })

  it('adds an archived session to the live ones on the same day and model', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-08T10:00:00Z', tokens: 5 }])
    const { deps } = withArchive(
      [archived(100)],
      new Map([[100, slotsOf(slotAt('2026-03-08T11:00:00Z', 7))]])
    )

    expect(tokensOn(await usageOf(deps), '2026-03-08')).toBe(12)
  })

  it('never counts the archived row of a live session a second time', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-08T10:00:00Z', tokens: 5 }])
    const live = await usageOf(depsAt().deps)
    const { deps } = withArchive(
      [archived(1)],
      new Map([[1, slotsOf(slotAt('2026-03-08T10:00:00Z', 999))]])
    )

    expect(await usageOf(deps)).toEqual(live)
  })

  it('never counts the archived row of a live session the window left unread', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-01-01T10:00:00Z' }], NOW - 90 * DAY)
    const { deps } = withArchive(
      [archived(1)],
      new Map([[1, slotsOf(slotAt('2026-03-08T10:00:00Z', 999))]])
    )

    expect(tokensOn(await usageOf(deps), '2026-03-08')).toBe(0)
  })

  it('reads the slots of no archived session that ended before the window and its slack', async () => {
    await removeTreeSession()
    const old = archived(100, {
      activity: { earliestMs: 1, latestMs: NOW - TOTALS_WINDOW_MS['7d'] - 3 * DAY },
      modifiedMs: NOW - TOTALS_WINDOW_MS['7d'] - 3 * DAY
    })
    const { deps, archive } = withArchive([old])
    const read = vi.spyOn(archive, 'readLeadSlots')

    const usage = await usageOf(deps)

    expect(read).not.toHaveBeenCalled()
    expect(usage.partial.unreadable).toBe(0)
  })

  it('reads the slots of an archived session inside the day of slack before the window', async () => {
    await removeTreeSession()
    const edge = archived(100, {
      activity: { earliestMs: 1, latestMs: NOW - TOTALS_WINDOW_MS['7d'] - DAY },
      modifiedMs: NOW - TOTALS_WINDOW_MS['7d'] - DAY
    })
    const { deps, archive } = withArchive([edge])
    const read = vi.spyOn(archive, 'readLeadSlots')

    await usageOf(deps)

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('counts an archived session in the window with no lead slots as unreadable', async () => {
    await removeTreeSession()
    const { deps } = withArchive([archived(100)])

    const usage = await usageOf(deps)

    expect(usage.partial.unreadable).toBe(1)
  })

  it('counts an archived session with subagents as missing their usage, and still counts its lead', async () => {
    await removeTreeSession()
    const slots = new Map([[100, slotsOf(slotAt('2026-03-08T10:00:00Z', 30))]])
    const { deps } = withArchive([archived(100, { subagentCount: 2 }), archived(101)], slots)

    const usage = await usageOf(deps)

    expect(usage.partial).toMatchObject({ archivedWithoutSubagents: 1, unreadableSubagents: 0 })
    expect(tokensOn(usage, '2026-03-08')).toBe(30)
  })

  it('counts an archived session whose subagent count is unknown as missing their usage', async () => {
    await removeTreeSession()
    const slots = new Map([[100, slotsOf(slotAt('2026-03-08T10:00:00Z', 30))]])
    const { deps } = withArchive([archived(100, { subagentCount: null })], slots)

    expect((await usageOf(deps)).partial.archivedWithoutSubagents).toBe(1)
  })

  it('counts undated messages and unreadable lines an archived session had', async () => {
    await removeTreeSession()
    const slots = new Map([
      [100, { ...slotsOf(slotAt('2026-03-08T10:00:00Z', 30)), undatedMessages: 2 }]
    ])
    const { deps } = withArchive([archived(100, { skippedLines: 3 })], slots)

    const usage = await usageOf(deps)

    expect(usage.partial).toMatchObject({ undated: 1, skippedLines: 1 })
  })

  it('still reports the live sessions, logging the failure once, when the archive cannot be read', async () => {
    await removeTreeSession()
    await writeSession(1, [{ at: '2026-03-08T10:00:00Z', tokens: 5 }])
    const live = await usageOf(depsAt().deps)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing: IpcDeps = {
      ...depsAt().deps,
      archive: createFakeArchive(Object.assign(new Error('boom'), { code: 'EDAILYFAIL' }))
    }

    try {
      expect(await usageOf(failing)).toEqual(live)
      expect(warn.mock.calls).toEqual([['Beekeeper archive read failed (EDAILYFAIL).']])
    } finally {
      warn.mockRestore()
    }
  })
})
