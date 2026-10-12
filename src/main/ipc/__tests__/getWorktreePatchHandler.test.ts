import { describe, expect, it } from 'vitest'
import { err } from '../../../core/shared/result'
import { MAX_AGENT_ID_LENGTH } from '../../../shared/ipc/requestSchemas'
import { getWorktreePatchHandler } from '../getWorktreePatchHandler'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID, agentId: 'a1' }

/** Counts scans and git lookups, locating no git. */
function countingDeps(base: IpcDeps): { deps: IpcDeps; counts: { scans: number; git: number } } {
  const counts = { scans: 0, git: 0 }
  const deps: IpcDeps = {
    ...base,
    scans: {
      run: (key, task) => {
        counts.scans += 1
        return base.scans.run(key, task)
      }
    },
    git: () => {
      counts.git += 1
      return Promise.resolve(err('git-not-found'))
    }
  }
  return { deps, counts }
}

describe('getWorktreePatchHandler request validation', () => {
  // Which requests the schema refuses is covered in requestSchemas.test.ts; these show the
  // handler refuses one before it locates git or scans anything.
  it.each([
    ['no agent id', { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }],
    ['an agent id with a slash', { ...request, agentId: '../a1' }],
    ['an extra field', { ...request, path: '/etc' }],
    ['no payload', undefined]
  ])('refuses %s, locating no git and scanning nothing', async (_label, payload) => {
    const { deps, counts } = countingDeps(ctx.deps)

    expect(await getWorktreePatchHandler(deps, payload)).toEqual({
      ok: false,
      error: { code: 'invalid-request' }
    })
    expect(counts).toEqual({ scans: 0, git: 0 })
  })

  it('accepts an agent id as long as a filename allows, and one that is not hex', async () => {
    const { deps } = countingDeps(ctx.deps)

    const long = await getWorktreePatchHandler(deps, {
      ...request,
      agentId: 'a'.repeat(MAX_AGENT_ID_LENGTH)
    })
    const odd = await getWorktreePatchHandler(deps, { ...request, agentId: 'task-é 1' })

    expect(long).toEqual({ ok: true, value: { kind: 'unavailable', git: 'git-not-found' } })
    expect(odd).toEqual({ ok: true, value: { kind: 'unavailable', git: 'git-not-found' } })
  })

  it('finds no session that is not listed, locating no git and scanning nothing', async () => {
    const { deps, counts } = countingDeps(ctx.deps)

    const result = await getWorktreePatchHandler(deps, {
      ...request,
      sessionId: '2b2b2b2b-2222-4222-8222-22222222222b'
    })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(counts).toEqual({ scans: 0, git: 0 })
  })

  it('says git is unavailable, without scanning, when there is no git', async () => {
    const { deps, counts } = countingDeps(ctx.deps)

    expect(await getWorktreePatchHandler(deps, request)).toEqual({
      ok: true,
      value: { kind: 'unavailable', git: 'git-not-found' }
    })
    expect(counts.scans).toBe(0)
  })
})
