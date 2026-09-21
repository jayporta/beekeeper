import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readSubagentMeta } from '../../transcript/readSubagentMeta'
import { buildMinimalSubagentMeta } from '../../transcript/testFixtures'
import { resolveSubagentMeta } from '../resolveSubagentMeta'

vi.mock('../../transcript/readSubagentMeta', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../transcript/readSubagentMeta')>()
  return { ...actual, readSubagentMeta: vi.fn(actual.readSubagentMeta) }
})

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'beekeeper-resolve-meta-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.mocked(readSubagentMeta).mockClear()
})

describe('resolveSubagentMeta', () => {
  it('reports absent when metaPath is null', async () => {
    expect(await resolveSubagentMeta(null)).toEqual({ status: 'absent' })
  })

  it('reports ok with the validated meta for a well-formed file', async () => {
    const path = join(dir, 'agent-a.meta.json')
    writeFileSync(path, JSON.stringify(buildMinimalSubagentMeta('general-purpose')), 'utf-8')

    expect(await resolveSubagentMeta(path)).toEqual({
      status: 'ok',
      meta: { agentType: 'general-purpose' }
    })
  })

  it('reports an error with reason missing when the meta file does not exist', async () => {
    expect(await resolveSubagentMeta(join(dir, 'missing.meta.json'))).toEqual({
      status: 'error',
      reason: 'missing'
    })
  })

  it('reports an error with reason invalid-json when the meta file is invalid JSON', async () => {
    const path = join(dir, 'agent-broken.meta.json')
    writeFileSync(path, 'not json', 'utf-8')

    expect(await resolveSubagentMeta(path)).toEqual({ status: 'error', reason: 'invalid-json' })
  })

  it('reports an error with reason invalid-shape when the meta file fails schema validation', async () => {
    const path = join(dir, 'agent-shapeless.meta.json')
    writeFileSync(path, JSON.stringify({ description: 'no agentType' }), 'utf-8')

    expect(await resolveSubagentMeta(path)).toEqual({ status: 'error', reason: 'invalid-shape' })
  })

  it('reports an error with reason not-a-file when the path is a directory', async () => {
    expect(await resolveSubagentMeta(dir)).toEqual({ status: 'error', reason: 'not-a-file' })
  })

  it('reports an error with reason unreadable when the read throws an unexpected system error', async () => {
    const ioError = Object.assign(new Error('simulated I/O failure'), { code: 'EIO' })
    vi.mocked(readSubagentMeta).mockRejectedValueOnce(ioError)

    expect(await resolveSubagentMeta('/irrelevant/path')).toEqual({
      status: 'error',
      reason: 'unreadable'
    })
  })
})
