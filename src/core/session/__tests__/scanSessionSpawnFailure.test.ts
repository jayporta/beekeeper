import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkippedLineError } from '../../transcript/readRecords'
import { ok, type Result } from '../../transcript/result'
import { toAgentId } from '../../transcript/ids'
import { buildJsonlText } from '../../transcript/testFixtures'
import { scanSession } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'
import { buildBranchRecord, buildSpawnRecord } from '../testSpawnFixtures'

const { flakyPath } = vi.hoisted(() => ({ flakyPath: { current: null as string | null } }))

vi.mock('../../transcript/readRecords', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../transcript/readRecords')>()
  return {
    ...actual,
    readRecords: (filePath: string, readOptions?: Parameters<typeof actual.readRecords>[1]) =>
      filePath === flakyPath.current ? failAfterSpawn() : actual.readRecords(filePath, readOptions)
  }
})

async function* failAfterSpawn(): AsyncGenerator<
  Result<Record<string, unknown>, SkippedLineError>
> {
  yield ok(buildSpawnRecord({ toolUseIds: ['toolu_nested'], cwd: '/wt', gitBranch: 'agent/p' }))
  const error = new Error('simulated mid-read failure') as NodeJS.ErrnoException
  error.code = 'EIO'
  throw error
}

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
  flakyPath.current = null
})

describe('scanSession spawn contexts on a failed read', () => {
  it('takes no spawns from a subagent transcript that fails mid-read', async () => {
    const parent = dir.addSubagent('p', { transcript: '', meta: { agentType: 'x' } })
    flakyPath.current = parent.transcript.path
    const child = dir.addSubagent('c', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x', toolUseId: 'toolu_nested', parentAgentId: 'p' }
    })

    const result = await scanSession({
      leadPath: dir.writeLead(buildJsonlText([buildBranchRecord('main', '/lead-repo')])),
      subagents: [parent, child]
    })

    expect(result.spawnContexts.get(toAgentId('c'))).toEqual({
      cwd: '/lead-repo',
      baseBranch: 'main',
      inferred: true
    })
  })
})
