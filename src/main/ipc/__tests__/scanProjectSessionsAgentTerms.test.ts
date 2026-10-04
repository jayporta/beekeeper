import { describe, expect, it, vi, type Mock } from 'vitest'
import { NO_AGENT_TERMS } from '../../../core/session/agentSearchTerms'
import { err, ok } from '../../../core/shared/result'
import type { SessionEntry } from '../../../core/transcript/discoverSessions'
import { toAgentId, toSessionId } from '../../../core/transcript/ids'
import { scanProjectSessions, type ScanDeps } from '../scanProjectSessions'

const discovered = vi.hoisted(() => ({ entries: [] as SessionEntry[] }))

vi.mock('../../../core/transcript/discoverSessions', () => ({
  discoverSessions: () => Promise.resolve(discovered.entries)
}))

const FILE = { path: '/x/s.jsonl', mtimeMs: 1, size: 1 }
const SUBAGENT = {
  agentId: toAgentId('a1'),
  transcript: { path: '/x/s/subagents/agent-a1.jsonl', mtimeMs: 1, size: 1 },
  metaPath: null
}
const PROJECT = { dirName: '-p', path: '/x' } as never

function deps(): {
  read: Mock<NonNullable<ScanDeps['agentTerms']>['read']>
  keys: string[]
  scanDeps: ScanDeps
} {
  const read = vi.fn<NonNullable<ScanDeps['agentTerms']>['read']>(() =>
    Promise.resolve(NO_AGENT_TERMS)
  )
  const keys: string[] = []
  const record = <T>(key: string, task: () => Promise<T>): Promise<T> => {
    keys.push(key)
    return task()
  }
  const summaries: ScanDeps['summaries'] = { run: record, runInBackground: record }
  const summaryCache = {
    read: vi.fn(() => Promise.resolve(err({ reason: 'unreadable' as const, code: 'ENOENT' })))
  }
  const scanDeps: ScanDeps = {
    summaryCache: summaryCache as never,
    summaries,
    agentTerms: { read }
  }
  return { read, keys, scanDeps }
}

function session(overrides: Partial<SessionEntry>): SessionEntry {
  return {
    sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
    transcript: ok(FILE),
    subagents: ok([SUBAGENT]),
    ...overrides
  }
}

describe('scanProjectSessions agent terms', () => {
  it('reads the terms of a session with subagents, through the scheduler', async () => {
    discovered.entries = [session({})]
    const { read, keys, scanDeps } = deps()

    await scanProjectSessions({ project: PROJECT }, scanDeps)

    expect(read).toHaveBeenCalledWith([SUBAGENT])
    expect(keys.some((key) => key.startsWith('terms\0'))).toBe(true)
  })

  it.each([
    ['has no subagents', { subagents: ok([]) }],
    [
      'has subagents that could not be listed',
      { subagents: err({ reason: 'unreadable' as const, code: 'EACCES' }) }
    ],
    [
      'has a transcript that could not be read',
      { transcript: err({ reason: 'unreadable' as const, code: 'EACCES' }) }
    ]
  ])(
    'reads no terms and takes no scheduler turn for a session that %s',
    async (_name, overrides) => {
      discovered.entries = [session(overrides)]
      const { read, keys, scanDeps } = deps()

      const [scanned] = await scanProjectSessions({ project: PROJECT }, scanDeps)

      expect(read).not.toHaveBeenCalled()
      expect(keys.some((key) => key.startsWith('terms\0'))).toBe(false)
      expect(scanned?.agentTerms).toBe(NO_AGENT_TERMS)
    }
  )

  it('reads no terms in a background scan', async () => {
    discovered.entries = [session({})]
    const { read, scanDeps } = deps()

    const [scanned] = await scanProjectSessions({ project: PROJECT, background: true }, scanDeps)

    expect(read).not.toHaveBeenCalled()
    expect(scanned?.agentTerms).toBe(NO_AGENT_TERMS)
  })

  it('reads no terms when the dependencies carry no agent terms cache', async () => {
    discovered.entries = [session({})]
    const { scanDeps } = deps()
    const withoutTerms: ScanDeps = {
      summaryCache: scanDeps.summaryCache,
      summaries: scanDeps.summaries
    }

    const [scanned] = await scanProjectSessions({ project: PROJECT }, withoutTerms)

    expect(scanned?.agentTerms).toBe(NO_AGENT_TERMS)
  })
})
