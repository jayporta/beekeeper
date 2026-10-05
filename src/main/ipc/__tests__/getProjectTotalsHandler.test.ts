import { chmod, mkdir, rm, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildAiTitleRecord,
  buildAssistantRecord,
  buildCostStateRecord
} from '../../../core/transcript/testFixtures'
import { createSessionSummaryCache } from '../../../core/transcript/summary/sessionSummaryCache'
import { SKIP_UNREAD_SLACK_MS, TOTALS_WINDOW_MS } from '../../overview/totalsWindow'
import { getProjectTotalsHandler } from '../getProjectTotalsHandler'
import { guardIpc } from '../guardIpc'
import type { IpcDeps } from '../ipcDeps'
import { AGENT_SESSION_ID, WORKTREE, scoutRecords, writeTranscript } from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const NOW = Date.parse('2026-03-01T00:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const WEEK = TOTALS_WINDOW_MS['7d']
const CUTOFF = NOW - WEEK
const request = { projectDirName: TEST_PROJECT, window: '7d' }

afterEach(async () => {
  await chmod(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT), 0o755).catch(
    () => undefined
  )
})

const idOf = (n: number): string => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`

interface SessionToWrite {
  readonly n: number
  /** When the session was last active, as its records say. */
  readonly activeMs: number
  /** When its file was last written. Defaults to `activeMs`. */
  readonly mtimeMs?: number
  readonly title?: string
  readonly recorded?: boolean
  readonly folder?: string
}

/** Writes a lead session whose last record is at `activeMs`, with its file time set. */
async function writeSession(session: SessionToWrite): Promise<string> {
  const { n, activeMs, mtimeMs = activeMs, title, recorded = true, folder = TEST_PROJECT } = session
  await writeTranscript(ctx.tree.home, {
    projectDirName: folder,
    sessionId: idOf(n),
    records: [
      ...(title === undefined ? [] : [buildAiTitleRecord(title)]),
      buildAssistantRecord({
        messageId: `msg_${n}`,
        timestamp: new Date(activeMs).toISOString()
      }),
      ...(recorded ? [buildCostStateRecord()] : [])
    ]
  })
  const path = join(ctx.tree.home, '.claude', 'projects', folder, `${idOf(n)}.jsonl`)
  await utimes(path, new Date(mtimeMs), new Date(mtimeMs))
  return path
}

/** Deps whose summary cache records every transcript it reads, by path. */
function spyingDeps(): { deps: IpcDeps; reads: string[] } {
  const reads: string[] = []
  const inner = createSessionSummaryCache()
  const deps: IpcDeps = {
    ...ctx.deps,
    summaryCache: {
      read: (file) => {
        reads.push(file.path)
        return inner.read(file)
      }
    }
  }
  return { deps, reads }
}

/** Clears the tree's own session, which is dated by the clock, so it doesn't count. */
async function removeTreeSession(): Promise<void> {
  await rm(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, `${TEST_SESSION_ID}.jsonl`))
}

/** `deps` with the clock stopped at {@link NOW}. */
const atNow = (deps: IpcDeps): IpcDeps => ({ ...deps, now: () => NOW })

const totalsOf = async (
  deps: IpcDeps,
  window: '7d' | '30d' = '7d'
): ReturnType<typeof getProjectTotalsHandler> =>
  getProjectTotalsHandler(atNow(deps), { ...request, window })

function value(
  result: Awaited<ReturnType<typeof totalsOf>>
): Extract<typeof result, { ok: true }>['value'] {
  if (!result.ok) throw new Error('expected totals')
  return result.value
}

describe('getProjectTotalsHandler request validation', () => {
  it.each([
    ['an unknown window', { ...request, window: '1d' }],
    ['no window', { projectDirName: TEST_PROJECT }],
    ['a window that is not text', { ...request, window: 7 }],
    ['an extra field', { ...request, path: '/etc' }],
    ['a project name that is a path', { ...request, projectDirName: '../x' }],
    ['no payload', undefined]
  ])('refuses %s, reading nothing', async (_label, payload) => {
    const { deps, reads } = spyingDeps()

    expect(await getProjectTotalsHandler(atNow(deps), payload)).toEqual({
      ok: false,
      error: { code: 'invalid-request' }
    })
    expect(reads).toEqual([])
  })

  it('finds no project that is not listed, reading nothing', async () => {
    const { deps, reads } = spyingDeps()

    const result = await getProjectTotalsHandler(atNow(deps), {
      ...request,
      projectDirName: '-nope'
    })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(reads).toEqual([])
  })
})

describe('getProjectTotalsHandler totals', () => {
  it('adds up the sessions in the window, with the latest one’s title', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - DAY, title: 'Older' })
    await writeSession({ n: 2, activeMs: NOW - HOUR, title: 'Newest' })

    const totals = value(await totalsOf(ctx.deps))

    expect(totals).toMatchObject({
      tokens: 590,
      usd: 2.46,
      sessions: 2,
      agents: 2,
      latest: { sessionId: idOf(2), title: 'Newest', latestMs: NOW - HOUR }
    })
  })

  it('counts a teammate as an agent, never as a session, told by its role', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - HOUR })
    await writeTranscript(ctx.tree.home, {
      projectDirName: TEST_PROJECT,
      sessionId: AGENT_SESSION_ID,
      records: [
        ...scoutRecords(),
        buildAssistantRecord({ messageId: 'msg_t', timestamp: new Date(NOW - HOUR).toISOString() })
      ]
    })

    expect(value(await totalsOf(ctx.deps))).toMatchObject({ sessions: 1, agents: 2 })
  })

  it('reads only the folder’s own sessions, never a family folder’s', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - HOUR })
    const sibling = await writeSession({ n: 2, activeMs: NOW - HOUR, folder: WORKTREE })
    const { deps, reads } = spyingDeps()

    const totals = value(await totalsOf(deps))

    expect(reads).not.toContain(sibling)
    expect(totals.sessions).toBe(1)
  })

  it('counts the subagents of each session as agents', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - HOUR })
    const subagents = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, idOf(1), 'subagents')
    await mkdir(subagents, { recursive: true })
    await writeFile(join(subagents, 'agent-a1.jsonl'), '')
    await writeFile(join(subagents, 'agent-a2.jsonl'), '')

    expect(value(await totalsOf(ctx.deps)).agents).toBe(3)
  })

  it('sends the counts of sessions that leave the totals low', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - HOUR, recorded: false })
    const subagents = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, idOf(1), 'subagents')
    await mkdir(subagents, { recursive: true })
    await writeFile(join(subagents, 'agent-a1.jsonl'), '')

    expect(value(await totalsOf(ctx.deps))).toMatchObject({
      tokens: 15,
      partial: {
        withoutTokens: 0,
        withoutCost: 1,
        unreadable: 0,
        lowTokens: 1,
        uncountedSubagents: 0,
        undated: 0
      }
    })
  })

  it.skipIf(process.getuid?.() === 0)(
    'sends a session whose subagents folder cannot be read as uncounted subagents, not as low tokens',
    async () => {
      await removeTreeSession()
      await writeSession({ n: 1, activeMs: NOW - HOUR })
      const subagents = join(
        ctx.tree.home,
        '.claude',
        'projects',
        TEST_PROJECT,
        idOf(1),
        'subagents'
      )
      await mkdir(subagents, { recursive: true })
      try {
        await chmod(subagents, 0o000)

        expect(value(await totalsOf(ctx.deps))).toMatchObject({
          agents: 1,
          partial: { lowTokens: 0, uncountedSubagents: 1 }
        })
      } finally {
        await chmod(subagents, 0o755)
      }
    }
  )

  it('counts a session from the 30 day window that the 7 day window leaves out', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - 10 * DAY })

    expect(value(await totalsOf(ctx.deps, '7d')).sessions).toBe(0)
    expect(value(await totalsOf(ctx.deps, '30d')).sessions).toBe(1)
  })

  it('is all zero for a folder with no sessions', async () => {
    await removeTreeSession()

    expect(value(await totalsOf(ctx.deps))).toEqual({
      tokens: 0,
      usd: 0,
      sessions: 0,
      agents: 0,
      latest: null,
      partial: {
        withoutTokens: 0,
        withoutCost: 0,
        unreadable: 0,
        lowTokens: 0,
        uncountedSubagents: 0,
        undated: 0
      }
    })
  })

  it('sends only the whitelisted fields', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - HOUR, title: 'T' })

    const totals = value(await totalsOf(ctx.deps))

    expect(Object.keys(totals).sort()).toEqual([
      'agents',
      'latest',
      'partial',
      'sessions',
      'tokens',
      'usd'
    ])
    expect(Object.keys(totals.partial).sort()).toEqual([
      'lowTokens',
      'uncountedSubagents',
      'undated',
      'unreadable',
      'withoutCost',
      'withoutTokens'
    ])
    expect(Object.keys(totals.latest ?? {}).sort()).toEqual(['latestMs', 'sessionId', 'title'])
  })
})

describe('getProjectTotalsHandler window edge', () => {
  it('counts a session active exactly at the start of the window', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: CUTOFF })

    expect(value(await totalsOf(ctx.deps)).sessions).toBe(1)
  })

  it('leaves out a session active a millisecond before it, though its file is new', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: CUTOFF - 1, mtimeMs: NOW })

    expect(value(await totalsOf(ctx.deps)).sessions).toBe(0)
  })
})

describe('getProjectTotalsHandler reading only what can count', () => {
  it('never reads a session whose file is older than the window and the slack', async () => {
    await removeTreeSession()
    const old = await writeSession({ n: 1, activeMs: CUTOFF - SKIP_UNREAD_SLACK_MS - 1000 })
    const fresh = await writeSession({ n: 2, activeMs: NOW - HOUR })
    const { deps, reads } = spyingDeps()

    const totals = value(await totalsOf(deps))

    expect(reads).toEqual([fresh])
    expect(reads).not.toContain(old)
    expect(totals.sessions).toBe(1)
  })

  it('reads a session whose file is just inside the slack, and leaves it out if its activity is old', async () => {
    await removeTreeSession()
    const edge = await writeSession({
      n: 1,
      activeMs: CUTOFF - 5 * DAY,
      mtimeMs: CUTOFF - SKIP_UNREAD_SLACK_MS
    })
    const { deps, reads } = spyingDeps()

    const totals = value(await totalsOf(deps))

    expect(reads).toEqual([edge])
    expect(totals.sessions).toBe(0)
  })

  it('skips a session whose file is a millisecond past the slack', async () => {
    await removeTreeSession()
    const past = await writeSession({
      n: 1,
      activeMs: CUTOFF - 5 * DAY,
      mtimeMs: CUTOFF - SKIP_UNREAD_SLACK_MS - 1
    })
    const { deps, reads } = spyingDeps()

    await totalsOf(deps)

    expect(reads).not.toContain(past)
  })

  it('counts a session whose file looks a half day older than the window but whose activity is recent', async () => {
    await removeTreeSession()
    await writeSession({ n: 1, activeMs: NOW - HOUR, mtimeMs: CUTOFF - 12 * HOUR })

    expect(value(await totalsOf(ctx.deps)).sessions).toBe(1)
  })

  it('reads each kept transcript through the shared summary scheduler, in its background lane', async () => {
    await removeTreeSession()
    const fresh = await writeSession({ n: 1, activeMs: NOW - HOUR })
    const background: string[] = []
    const foreground: string[] = []
    const deps: IpcDeps = {
      ...ctx.deps,
      summaries: {
        run: (key, task) => {
          foreground.push(key)
          return ctx.deps.summaries.run(key, task)
        },
        runInBackground: (key, task) => {
          background.push(key)
          return ctx.deps.summaries.runInBackground(key, task)
        }
      }
    }

    await totalsOf(deps)

    expect(background).toHaveLength(1)
    expect(background[0]).toContain(fresh)
    expect(foreground).toEqual([])
  })
})

describe('getProjectTotalsHandler failure codes', () => {
  it('answers a folder that can’t be read with the unreadable code alone, through the guard', async (context) => {
    if (process.getuid?.() === 0) return context.skip()
    await chmod(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT), 0o000)
    const listener = guardIpc({
      isTrusted: () => true,
      handle: (payload) => getProjectTotalsHandler(atNow(ctx.deps), payload)
    })

    expect(await listener({}, request)).toEqual({ ok: false, error: { code: 'unreadable' } })
  })

  it('answers an unexpected failure with the internal code alone, without its message', async () => {
    const deps: IpcDeps = {
      ...ctx.deps,
      summaryCache: { read: () => Promise.reject(new Error('/secret/path leaked')) }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: (payload) => getProjectTotalsHandler(atNow(deps), payload),
      log: () => undefined
    })

    const result = await listener({}, request)

    expect(result).toEqual({ ok: false, error: { code: 'internal' } })
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})
