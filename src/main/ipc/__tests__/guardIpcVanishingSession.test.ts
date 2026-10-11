import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { getSession } from '../../../service/sessionDetail/getSession'
import type { ServiceDeps } from '../../../service/serviceDeps'
import { NO_SCAN_CACHE, TEST_PROJECT, TEST_SESSION_ID } from '../../../service/testServiceTree'
import { guardIpc } from '../guardIpc'
import { registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

describe('guardIpc around getSession', () => {
  it('returns not-found when the transcript vanishes mid-scan', async () => {
    const vanishing: ServiceDeps['scans'] = {
      run: async (_key, task) => {
        await rm(ctx.tree.sessionPath)
        return task()
      }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: () =>
        getSession(
          { ...ctx.deps, scans: vanishing, scanCache: NO_SCAN_CACHE },
          { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }
        )
    })

    expect(await listener({})).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})
