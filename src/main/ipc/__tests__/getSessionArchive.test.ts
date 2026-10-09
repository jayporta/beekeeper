import { stat } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ARCHIVE_DETAIL_AFTER_DAYS } from '../../archive/archiveConstants'
import { createFakeArchiveWriter } from '../../archive/testFakeArchiveWriter'
import { errorWithCode } from '../../testErrorWithCode'
import { getSessionHandler } from '../getSessionHandler'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }
const DAY_MS = 86_400_000

afterEach(() => {
  vi.restoreAllMocks()
})

/** Deps whose clock is `days` after the transcript's last modification. */
async function depsAfter(days: number, extra: Partial<IpcDeps>): Promise<IpcDeps> {
  const { mtimeMs } = await stat(ctx.tree.sessionPath)
  return { ...ctx.deps, now: () => Math.max(mtimeMs, Date.now()) + days * DAY_MS, ...extra }
}

describe('getSessionHandler archive', () => {
  it('saves the detail with the lead transcript state once the session has been quiet long enough', async () => {
    const archive = createFakeArchiveWriter()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })

    const result = await getSessionHandler(deps, request)

    const info = await stat(ctx.tree.sessionPath)
    expect(archive.detailSaves).toHaveLength(1)
    expect(archive.detailSaves[0]?.ref).toEqual(request)
    expect(archive.detailSaves[0]?.source).toEqual({ mtimeMs: info.mtimeMs, size: info.size })
    expect(result.ok && result.value).toEqual(archive.detailSaves[0]?.detail)
  })

  it('does not save the detail of a session active within the waiting period', async () => {
    const archive = createFakeArchiveWriter()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS - 1, { archive })

    await getSessionHandler(deps, request)

    expect(archive.detailSaves).toEqual([])
  })

  it('returns the detail without touching an archive when none is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive: null })

    const result = await getSessionHandler(deps, request)

    expect(result.ok).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not save a detail for a request that fails', async () => {
    const archive = createFakeArchiveWriter()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })

    const result = await getSessionHandler(deps, { ...request, sessionId: 'not-a-session' })

    expect(result.ok).toBe(false)
    expect(archive.detailSaves).toEqual([])
  })

  it('returns the same detail when the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = createFakeArchiveWriter(errorWithCode('EDETAIL_THROWS'))
    const withArchive = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })
    const without = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive: null })

    const guarded = await getSessionHandler(withArchive, request)
    const plain = await getSessionHandler(without, request)

    expect(guarded).toEqual(plain)
    expect(warn.mock.calls).toEqual([['Beekeeper archive write failed (EDETAIL_THROWS).']])
  })
})
