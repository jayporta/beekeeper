import { describe, expect, it } from 'vitest'
import { getWorktreePatch } from '../getWorktreePatch'
import { countingDeps } from '../testCountingDeps'
import { registerServiceTestTree, TEST_PROJECT, TEST_SESSION_ID } from '../../testServiceTree'

const ctx = registerServiceTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID, agentId: 'a1' }

describe('getWorktreePatch', () => {
  it('finds no session that is not listed, locating no git and scanning nothing', async () => {
    const { deps, counts } = countingDeps(ctx.deps)

    const result = await getWorktreePatch(deps, {
      ...request,
      sessionId: '2b2b2b2b-2222-4222-8222-22222222222b'
    })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(counts).toEqual({ scans: 0, git: 0 })
  })

  it('says git is unavailable, without scanning, when there is no git', async () => {
    const { deps, counts } = countingDeps(ctx.deps)

    expect(await getWorktreePatch(deps, request)).toEqual({
      ok: true,
      value: { kind: 'unavailable', git: 'git-not-found' }
    })
    expect(counts.scans).toBe(0)
  })
})
