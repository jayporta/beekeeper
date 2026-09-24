import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { toAgentId } from '../../transcript/ids'
import { buildJsonlText } from '../../transcript/testFixtures'
import { scanSession, type SessionScan } from '../scanSession'
import { createSessionScanDir, type SessionScanDir } from '../testSessionDir'
import { buildBranchRecord, buildSpawnRecord } from '../testSpawnFixtures'

let dir: SessionScanDir

beforeEach(() => {
  dir = createSessionScanDir()
})

afterEach(() => {
  dir.cleanup()
})

async function scan(
  lead: readonly unknown[],
  subagents: ReturnType<SessionScanDir['addSubagent']>[]
): Promise<SessionScan> {
  return scanSession({ leadPath: dir.writeLead(buildJsonlText(lead)), subagents })
}

describe('scanSession spawn contexts', () => {
  it('resolves a spawn made in the lead transcript', async () => {
    const sub = dir.addSubagent('a', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x', toolUseId: 'toolu_1' }
    })

    const result = await scan(
      [buildSpawnRecord({ toolUseIds: ['toolu_1'], gitBranch: 'feat/a' })],
      [sub]
    )

    expect(result.spawnContexts.get(toAgentId('a'))).toEqual({
      cwd: '/repo',
      baseBranch: 'feat/a',
      inferred: false
    })
  })

  it('resolves a nested spawn made in a subagent transcript', async () => {
    const parent = dir.addSubagent('p', {
      transcript: buildJsonlText([
        buildSpawnRecord({ toolUseIds: ['toolu_nested'], cwd: '/wt', gitBranch: 'agent/p' })
      ]),
      meta: { agentType: 'x', toolUseId: 'toolu_top' }
    })
    const child = dir.addSubagent('c', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x', toolUseId: 'toolu_nested', parentAgentId: 'p' }
    })

    const result = await scan([buildSpawnRecord({ toolUseIds: ['toolu_top'] })], [parent, child])

    expect(result.spawnContexts.get(toAgentId('c'))).toEqual({
      cwd: '/wt',
      baseBranch: 'agent/p',
      inferred: false
    })
  })

  it("gives a teammate with no toolUseId the lead's branch, borrowing past a trailing HEAD", async () => {
    const mate = dir.addSubagent('m', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x', teamName: 'core' }
    })

    const result = await scan(
      [buildBranchRecord('feat/last', '/lead-repo'), buildBranchRecord('HEAD', '/lead-repo')],
      [mate]
    )

    expect(result.spawnContexts.get(toAgentId('m'))).toEqual({
      cwd: '/lead-repo',
      baseBranch: 'feat/last',
      inferred: true
    })
  })

  it('has no context when the session recorded no valid branch and no spawn', async () => {
    const mate = dir.addSubagent('m', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x' }
    })

    const result = await scan([buildBranchRecord(undefined)], [mate])

    expect(result.spawnContexts.size).toBe(0)
  })

  it('does not resolve a toolUseId exactly from an unrelated sibling transcript', async () => {
    const sibling = dir.addSubagent('s', {
      transcript: buildJsonlText([
        buildSpawnRecord({ toolUseIds: ['toolu_forged'], cwd: '/forged', gitBranch: 'evil' })
      ]),
      meta: { agentType: 'x' }
    })
    const victim = dir.addSubagent('v', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x', toolUseId: 'toolu_forged' }
    })

    const result = await scan([buildBranchRecord('main', '/lead-repo')], [sibling, victim])

    expect(result.spawnContexts.get(toAgentId('v'))).toEqual({
      cwd: '/lead-repo',
      baseBranch: 'main',
      inferred: true
    })
  })

  it("infers a nested agent with no toolUseId from its parent transcript's last branch", async () => {
    const parent = dir.addSubagent('p', {
      transcript: buildJsonlText([buildBranchRecord('agent/p', '/wt')]),
      meta: { agentType: 'x' }
    })
    const child = dir.addSubagent('c', {
      transcript: buildJsonlText([]),
      meta: { agentType: 'x', parentAgentId: 'p' }
    })

    const result = await scan([buildBranchRecord('main')], [parent, child])

    expect(result.spawnContexts.get(toAgentId('c'))).toEqual({
      cwd: '/wt',
      baseBranch: 'agent/p',
      inferred: true
    })
  })
})
