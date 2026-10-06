import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveSubagentMeta } from '../../../core/session/resolveSubagentMeta'
import type { SubagentMetaStatus } from '../../../core/session/subagentMetaStatus'
import { createSessionScanDir, type SessionScanDir } from '../../../core/session/testSessionDir'
import { agentTermsKey, createAgentTermsCache } from '../agentTermsCache'

let dir: SessionScanDir | undefined

afterEach(() => {
  dir?.cleanup()
  dir = undefined
})

function scanDir(): SessionScanDir {
  dir ??= createSessionScanDir()
  return dir
}

const meta = (agentType: string): Record<string, unknown> => ({ agentType })

describe('createAgentTermsCache', () => {
  it('reads no meta for a session without subagents', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)

    const terms = await createAgentTermsCache({ readMeta }).read([])

    expect(terms).toEqual([])
    expect(readMeta).not.toHaveBeenCalled()
  })

  it('collects the terms of the subagents’ metas', async () => {
    const subagents = [scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') })]

    expect(await createAgentTermsCache().read(subagents)).toEqual([
      { name: null, description: null, agentType: 'Explore' }
    ])
  })

  it('reads no meta again when the subagents are unchanged', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const cache = createAgentTermsCache({ readMeta })
    const subagents = [
      scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') }),
      scanDir().addSubagent('b', { transcript: '', meta: meta('Plan') })
    ]
    await cache.read(subagents)
    readMeta.mockClear()

    const again = await cache.read(subagents)

    expect(readMeta).not.toHaveBeenCalled()
    expect(again).toHaveLength(2)
  })

  it('reads the metas again when a subagent has spawned', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const cache = createAgentTermsCache({ readMeta })
    const first = scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') })
    await cache.read([first])
    const second = scanDir().addSubagent('b', { transcript: '', meta: meta('Plan') })

    const terms = await cache.read([first, second])

    expect(terms.map((term) => term.agentType)).toEqual(['Explore', 'Plan'])
  })

  it('reads no meta again when a subagent’s transcript has grown', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const cache = createAgentTermsCache({ readMeta })
    const entry = scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') })
    await cache.read([entry])
    readMeta.mockClear()

    await cache.read([
      {
        ...entry,
        transcript: { ...entry.transcript, mtimeMs: entry.transcript.mtimeMs + 5, size: 99 }
      }
    ])

    expect(readMeta).not.toHaveBeenCalled()
  })

  it('does not keep terms when a meta could not be read, so a recovered meta is picked up', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const cache = createAgentTermsCache({ readMeta })
    const subagents = [
      scanDir().addSubagent('a', { transcript: '', meta: 'not json' }),
      scanDir().addSubagent('b', { transcript: '', meta: meta('Plan') })
    ]

    const first = await cache.read(subagents)
    await cache.read(subagents)

    expect(first.map((term) => term.agentType)).toEqual(['Plan'])
    expect(readMeta).toHaveBeenCalledTimes(4)
  })

  it.each(['unreadable', 'missing', 'invalid-json'] as const)(
    'does not keep terms when a meta fails with a transient %s error',
    async (reason) => {
      const readMeta = vi.fn(() => Promise.resolve<SubagentMetaStatus>({ status: 'error', reason }))
      const cache = createAgentTermsCache({ readMeta })
      const subagents = [scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') })]
      await cache.read(subagents)
      await cache.read(subagents)

      expect(readMeta).toHaveBeenCalledTimes(2)
    }
  )

  it.each(['invalid-shape', 'too-large', 'symlink', 'not-a-file'] as const)(
    'keeps terms when a meta fails with a permanent %s error',
    async (reason) => {
      const readMeta = vi.fn(() => Promise.resolve<SubagentMetaStatus>({ status: 'error', reason }))
      const cache = createAgentTermsCache({ readMeta })
      const subagents = [scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') })]
      await cache.read(subagents)
      await cache.read(subagents)

      expect(readMeta).toHaveBeenCalledTimes(1)
    }
  )

  it('keeps subagents without a meta file as a hit', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const cache = createAgentTermsCache({ readMeta })
    const subagents = [scanDir().addSubagent('a', { transcript: '' })]
    await cache.read(subagents)
    await cache.read(subagents)

    expect(readMeta).not.toHaveBeenCalled()
  })

  it('forgets the least recently used session when the weight bound is passed', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const first = [scanDir().addSubagent('a', { transcript: '', meta: meta('One') })]
    const second = [scanDir().addSubagent('b', { transcript: '', meta: meta('Two') })]
    const oneEntry = 512 + agentTermsKey(first).length + 'One'.length + 20
    const cache = createAgentTermsCache({ readMeta, maxWeight: oneEntry })
    await cache.read(first)
    await cache.read(second)
    readMeta.mockClear()

    await cache.read(first)

    expect(readMeta).toHaveBeenCalledTimes(1)
  })

  it('serves, but does not keep, an entry heavier than the whole bound', async () => {
    const readMeta = vi.fn(resolveSubagentMeta)
    const cache = createAgentTermsCache({ readMeta, maxWeight: 10 })
    const subagents = [scanDir().addSubagent('a', { transcript: '', meta: meta('Explore') })]

    const terms = await cache.read(subagents)
    await cache.read(subagents)

    expect(terms).toHaveLength(1)
    expect(readMeta).toHaveBeenCalledTimes(2)
  })
})

function statOf(entry: { transcript: { mtimeMs: number; size: number } }): {
  mtimeMs: number
  size: number
} {
  return { mtimeMs: entry.transcript.mtimeMs, size: entry.transcript.size }
}

describe('createAgentTermsCache identity', () => {
  it('keeps two sessions apart even when their subagents’ files have the same stat', async () => {
    const cache = createAgentTermsCache()
    const first = scanDir().addSubagent('a', { transcript: '', meta: meta('One') })
    const second = scanDir().addSubagent('b', { transcript: '', meta: meta('Two') })
    const twin = { ...second, transcript: { ...second.transcript, ...statOf(first) } }
    await cache.read([first])

    const terms = await cache.read([twin])

    expect(terms.map((term) => term.agentType)).toEqual(['Two'])
  })
})

describe('agentTermsKey', () => {
  it('differs when a subagent gains a meta file', () => {
    const entry = scanDir().addSubagent('a', { transcript: '' })

    expect(agentTermsKey([entry])).not.toBe(
      agentTermsKey([{ ...entry, metaPath: `${entry.transcript.path}.meta.json` }])
    )
  })

  it('is a fixed-length hash however many subagents there are', () => {
    const entry = scanDir().addSubagent('a', { transcript: '' })

    expect(agentTermsKey([entry])).toMatch(/^[0-9a-f]{64}$/)
    expect(agentTermsKey(Array.from({ length: 500 }, () => entry))).toHaveLength(64)
  })
})
