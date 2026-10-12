import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getProjectTotals } from '../../../service/overview/getProjectTotals'
import type { ServiceDeps } from '../../../service/serviceDeps'
import { TEST_PROJECT } from '../../../service/testServiceTree'
import { guardIpc } from '../guardIpc'
import { registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, window: '7d' } as const

afterEach(async () => {
  await chmod(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT), 0o755).catch(
    () => undefined
  )
})

describe('guardIpc around getProjectTotals', () => {
  it('answers a folder that can’t be read with the unreadable code alone', async (context) => {
    if (process.getuid?.() === 0) return context.skip()
    await chmod(join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT), 0o000)
    const listener = guardIpc({
      isTrusted: () => true,
      handle: () => getProjectTotals(ctx.deps, request)
    })

    expect(await listener({})).toEqual({ ok: false, error: { code: 'unreadable' } })
  })

  it('answers an unexpected failure with the internal code alone, without its message', async () => {
    const deps: ServiceDeps = {
      ...ctx.deps,
      summaryCache: { read: () => Promise.reject(new Error('/secret/path leaked')) }
    }
    const listener = guardIpc({
      isTrusted: () => true,
      handle: () => getProjectTotals(deps, request),
      log: () => undefined
    })

    const result = await listener({})

    expect(result).toEqual({ ok: false, error: { code: 'internal' } })
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})
