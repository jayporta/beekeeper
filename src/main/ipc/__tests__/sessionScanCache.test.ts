import { afterEach, describe, expect, it } from 'vitest'
import { scanSession, type SessionScan } from '../../../core/session/scanSession'
import { createSessionScanDir } from '../../../core/session/testSessionDir'
import { buildJsonlText } from '../../../core/transcript/testFixtures'
import { createSessionScanCache } from '../sessionScanCache'

const cleanups: (() => void)[] = []

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
})

/** How the synthetic subagent breaks, if it does. */
type Fault = 'none' | 'missing-transcript' | 'bad-meta'

async function scanWith(fault: Fault): Promise<SessionScan> {
  const dir = createSessionScanDir()
  cleanups.push(dir.cleanup)
  const subagent =
    fault === 'missing-transcript'
      ? dir.missingSubagent('a')
      : dir.addSubagent('a', {
          transcript: buildJsonlText([]),
          meta: fault === 'bad-meta' ? '{not json' : { agentType: 'x' }
        })
  return scanSession({ leadPath: dir.writeLead(buildJsonlText([])), subagents: [subagent] })
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

  it('skips a scan with an unreadable meta file', async () => {
    const cache = createSessionScanCache({ capacity: 2 })
    cache.set('a', await scanWith('bad-meta'), true)
    expect(cache.get('a')).toBeUndefined()
  })
})
