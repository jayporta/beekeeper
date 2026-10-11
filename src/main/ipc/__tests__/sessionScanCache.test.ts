import { chmodSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentTreeNode } from '../../../core/session/agentTree'
import { scanSession, type SessionScan } from '../../../core/session/scanSession'
import type { SubagentMetaStatus } from '../../../core/session/subagentMetaStatus'
import { createSessionScanDir } from '../../../core/session/testSessionDir'
import { buildJsonlText } from '../../../core/transcript/testFixtures'
import { createSessionScanCache, isArchivableScan } from '../sessionScanCache'

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** How the synthetic subagent breaks, if it does. */
type Fault = 'none' | 'missing-transcript' | 'bad-json-meta' | 'bad-shape-meta' | 'locked-meta'

const META_BY_FAULT: Partial<Record<Fault, string | Record<string, unknown>>> = {
  'bad-json-meta': '{not json',
  'bad-shape-meta': {}
}

async function scanWith(fault: Fault): Promise<SessionScan> {
  const dir = createSessionScanDir()
  cleanups.push(dir.cleanup)
  const subagent =
    fault === 'missing-transcript'
      ? dir.missingSubagent('a')
      : dir.addSubagent('a', {
          transcript: buildJsonlText([]),
          meta: META_BY_FAULT[fault] ?? { agentType: 'x' }
        })
  if (fault === 'locked-meta' && subagent.metaPath !== null) chmodSync(subagent.metaPath, 0o000)
  return scanSession({ leadPath: dir.writeLead(buildJsonlText([])), subagents: [subagent] })
}

/** The same scan with a grandchild node added whose meta failed as `status` says. */
function withNestedMeta(scan: SessionScan, status: SubagentMetaStatus): SessionScan {
  const [child] = scan.tree.children
  if (child === undefined) throw new Error('the scan should have a subagent node')
  const grandchild: AgentTreeNode = { ...child, metaStatus: status, children: [] }
  return {
    ...scan,
    tree: { ...scan.tree, children: [{ ...child, children: [grandchild] }] }
  }
}

describe('createSessionScanCache', () => {
  it('returns a stored scan', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    const scan = await scanWith('none')
    cache.set('a', scan, true)
    expect(cache.get('a')).toBe(scan)
  })

  it('evicts the least recently used scan beyond capacity', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    const scan = await scanWith('none')
    cache.set('a', scan, true)
    cache.set('b', scan, true)
    cache.get('a')
    cache.set('c', scan, true)
    expect([cache.get('a') !== undefined, cache.get('b'), cache.get('c') !== undefined]).toEqual([
      true,
      undefined,
      true
    ])
  })

  it('skips a scan whose subagents folder was unreadable', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    cache.set('a', await scanWith('none'), false)
    expect(cache.get('a')).toBeUndefined()
  })

  it('skips a scan with an unreadable subagent transcript', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    cache.set('a', await scanWith('missing-transcript'), true)
    expect(cache.get('a')).toBeUndefined()
  })

  it('skips a scan whose meta file may be mid-write', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    cache.set('a', await scanWith('bad-json-meta'), true)
    expect(cache.get('a')).toBeUndefined()
  })

  it('stores a scan whose meta file failed in a way that repeats on every read', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    const scan = await scanWith('bad-shape-meta')
    cache.set('a', scan, true)
    expect(cache.get('a')).toBe(scan)
  })
})

describe('isArchivableScan', () => {
  it('accepts a scan whose meta file does not match the expected shape', async () => {
    expect(isArchivableScan(await scanWith('bad-shape-meta'), true)).toBe(true)
  })

  it('accepts a scan whose meta file is not valid JSON', async () => {
    expect(isArchivableScan(await scanWith('bad-json-meta'), true)).toBe(true)
  })

  it('accepts a scan with a settled meta error on a nested node', async () => {
    const scan = withNestedMeta(await scanWith('none'), {
      status: 'error',
      reason: 'invalid-shape'
    })
    expect(isArchivableScan(scan, true)).toBe(true)
  })

  it.skipIf(process.getuid?.() === 0)('rejects a scan whose meta file is unreadable', async () => {
    const scan = await scanWith('locked-meta')
    expect(scan.tree.children[0]?.metaStatus).toEqual({ status: 'error', reason: 'unreadable' })
    expect(isArchivableScan(scan, true)).toBe(false)
  })

  it('rejects a scan with an unreadable meta file on a nested node', async () => {
    const scan = withNestedMeta(await scanWith('none'), { status: 'error', reason: 'unreadable' })
    expect(isArchivableScan(scan, true)).toBe(false)
  })

  it('rejects a scan with an unreadable subagent transcript', async () => {
    expect(isArchivableScan(await scanWith('missing-transcript'), true)).toBe(false)
  })

  it('rejects a scan whose subagents folder was not listed', async () => {
    expect(isArchivableScan(await scanWith('none'), false)).toBe(false)
  })

  it('accepts a scan that read everything', async () => {
    expect(isArchivableScan(await scanWith('none'), true)).toBe(true)
  })
})
