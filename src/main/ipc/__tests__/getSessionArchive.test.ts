import { stat } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ARCHIVE_DETAIL_AFTER_DAYS, DAY_MS } from '../../archive/archiveConstants'
import { testDetail } from '../../archive/testArchiveFixtures'
import { createFakeArchiveWriter } from '../../archive/testFakeArchiveWriter'
import { sessionRefKey } from '../sessionRefKey'
import { errorWithCode } from '../../testErrorWithCode'
import { getSessionHandler } from '../getSessionHandler'
import type { IpcDeps } from '../ipcDeps'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

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

const GONE_ID = '9f9f9f9f-9999-4999-8999-99999999999a'
const GONE_REF = { projectDirName: TEST_PROJECT, sessionId: GONE_ID }

/** An archive holding a detail for each given ref, whose own session id matches the ref's. */
function archiveHolding(...refs: (typeof GONE_REF)[]): ReturnType<typeof createFakeArchiveWriter> {
  return createFakeArchiveWriter(undefined, {
    details: new Map(
      refs.map((ref) => [sessionRefKey(ref), { ...testDetail('kept'), sessionId: ref.sessionId }])
    )
  })
}

describe('getSessionHandler archived sessions', () => {
  it('marks a live session detail as not archived', async () => {
    const result = await getSessionHandler({ ...ctx.deps, archive: archiveHolding() }, request)

    expect(result.ok && result.value.archived).toBe(false)
  })

  it('returns the archived detail, marked archived, when the transcript is gone', async () => {
    const archive = archiveHolding(GONE_REF)

    const result = await getSessionHandler({ ...ctx.deps, archive }, GONE_REF)

    expect(result).toEqual({
      ok: true,
      value: { ...testDetail('kept'), sessionId: GONE_ID, archived: true }
    })
  })

  it('never replaces a live detail with the archived copy', async () => {
    const archive = archiveHolding(request)

    const result = await getSessionHandler({ ...ctx.deps, archive }, request)

    expect(result.ok && result.value.archived).toBe(false)
    expect(JSON.stringify(result)).not.toContain('kept')
  })

  it('answers not-found when the transcript is gone and the archive has no detail', async () => {
    const result = await getSessionHandler({ ...ctx.deps, archive: archiveHolding() }, GONE_REF)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('answers not-found, touching nothing, when no archive is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await getSessionHandler({ ...ctx.deps, archive: null }, GONE_REF)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(warn).not.toHaveBeenCalled()
  })

  it('answers not-found for a project folder that is gone, even with an archived detail', async () => {
    const gone = { projectDirName: '-no-such-project', sessionId: GONE_ID }

    const result = await getSessionHandler({ ...ctx.deps, archive: archiveHolding(gone) }, gone)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('answers invalid-request for a bad payload without reading the archive', async () => {
    const result = await getSessionHandler(
      { ...ctx.deps, archive: createFakeArchiveWriter(errorWithCode('EREAD_NEVER')) },
      { projectDirName: TEST_PROJECT, sessionId: 'not-a-uuid' }
    )

    expect(result).toEqual({ ok: false, error: { code: 'invalid-request' } })
  })

  it('answers not-found and logs once when reading the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = createFakeArchiveWriter(errorWithCode('EDETAIL_READ_THROWS'))

    const result = await getSessionHandler({ ...ctx.deps, archive }, GONE_REF)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(warn.mock.calls).toEqual([['Beekeeper archive read failed (EDETAIL_READ_THROWS).']])
  })
})
