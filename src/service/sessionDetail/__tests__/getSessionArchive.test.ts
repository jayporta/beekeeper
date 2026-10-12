import { chmod, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ARCHIVE_DETAIL_AFTER_DAYS, DAY_MS } from '../../archive/archiveDetailTiming'
import { testDetail } from '../../archive/testArchiveFixtures'
import { createFakeArchive } from '../../archive/testFakeArchive'
import { sessionRefKey } from '../../sessions/sessionRefKey'
import { getSession } from '../getSession'
import type { ServiceDeps } from '../../serviceDeps'
import { TEST_PROJECT, TEST_SESSION_ID } from '../../testServiceTree'
import { registerServiceTestTree } from '../../testServiceTree'

const ctx = registerServiceTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

afterEach(() => {
  vi.restoreAllMocks()
})

/** Deps whose clock is `days` after the transcript's last modification. */
async function depsAfter(days: number, extra: Partial<ServiceDeps>): Promise<ServiceDeps> {
  const { mtimeMs } = await stat(ctx.tree.sessionPath)
  return { ...ctx.deps, now: () => Math.max(mtimeMs, Date.now()) + days * DAY_MS, ...extra }
}

describe('getSession archive', () => {
  it('saves the detail with the lead transcript state once the session has been quiet long enough', async () => {
    const archive = createFakeArchive()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })

    const result = await getSession(deps, request)

    const info = await stat(ctx.tree.sessionPath)
    expect(archive.detailSaves).toHaveLength(1)
    expect(archive.detailSaves[0]?.ref).toEqual(request)
    expect(archive.detailSaves[0]?.source).toEqual({ mtimeMs: info.mtimeMs, size: info.size })
    expect(result.ok && result.value).toEqual(archive.detailSaves[0]?.detail)
  })

  it('does not save the detail of a session active within the waiting period', async () => {
    const archive = createFakeArchive()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS - 1, { archive })

    await getSession(deps, request)

    expect(archive.detailSaves).toEqual([])
  })

  it('returns the detail without touching an archive when none is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive: null })

    const result = await getSession(deps, request)

    expect(result.ok).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not save a detail for a request that fails', async () => {
    const archive = createFakeArchive()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })

    const result = await getSession(deps, { ...request, sessionId: 'not-a-session' })

    expect(result.ok).toBe(false)
    expect(archive.detailSaves).toEqual([])
  })
})

const GONE_ID = '9f9f9f9f-9999-4999-8999-99999999999a'
const GONE_REF = { projectDirName: TEST_PROJECT, sessionId: GONE_ID }

/** An archive holding a detail for each given ref, whose own session id matches the ref's. */
function archiveHolding(...refs: (typeof GONE_REF)[]): ReturnType<typeof createFakeArchive> {
  return createFakeArchive(undefined, {
    details: new Map(
      refs.map((ref) => [sessionRefKey(ref), { ...testDetail('kept'), sessionId: ref.sessionId }])
    )
  })
}

describe('getSession archived sessions', () => {
  it('marks a live session detail as not archived', async () => {
    const result = await getSession({ ...ctx.deps, archive: archiveHolding() }, request)

    expect(result.ok && result.value.archived).toBe(false)
  })

  it('returns the archived detail, marked archived, when the transcript is gone', async () => {
    const archive = archiveHolding(GONE_REF)

    const result = await getSession({ ...ctx.deps, archive }, GONE_REF)

    expect(result).toEqual({
      ok: true,
      value: { ...testDetail('kept'), sessionId: GONE_ID, archived: true }
    })
  })

  it('never replaces a live detail with the archived copy', async () => {
    const archive = archiveHolding(request)

    const result = await getSession({ ...ctx.deps, archive }, request)

    expect(result.ok && result.value.archived).toBe(false)
    expect(JSON.stringify(result)).not.toContain('kept')
  })

  it('answers not-found when the transcript is gone and the archive has no detail', async () => {
    const result = await getSession({ ...ctx.deps, archive: archiveHolding() }, GONE_REF)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('answers not-found, touching nothing, when no archive is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await getSession({ ...ctx.deps, archive: null }, GONE_REF)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(warn).not.toHaveBeenCalled()
  })

  it('answers not-found for a project folder that is gone, even with an archived detail', async () => {
    const gone = { projectDirName: '-no-such-project', sessionId: GONE_ID }

    const result = await getSession({ ...ctx.deps, archive: archiveHolding(gone) }, gone)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})

describe('getSession archive of a scan with a failed meta file', () => {
  const metaPath = (): string =>
    join(
      ctx.tree.home,
      '.claude',
      'projects',
      TEST_PROJECT,
      TEST_SESSION_ID,
      'subagents',
      'agent-a1.meta.json'
    )

  it('archives the detail of a quiet session whose subagent meta is not valid JSON', async () => {
    await writeFile(metaPath(), 'not json')
    const archive = createFakeArchive()
    const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })

    const result = await getSession(deps, request)

    expect(result.ok).toBe(true)
    expect(archive.detailSaves).toHaveLength(1)
  })

  it.skipIf(process.getuid?.() === 0)(
    'returns the detail but does not archive it while a subagent meta file cannot be read',
    async () => {
      await chmod(metaPath(), 0o000)
      const archive = createFakeArchive()
      const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })

      const result = await getSession(deps, request)

      expect(result.ok).toBe(true)
      expect(archive.detailSaves).toEqual([])
    }
  )

  it.skipIf(process.getuid?.() === 0)(
    'archives the detail once the meta file can be read',
    async () => {
      await chmod(metaPath(), 0o000)
      const archive = createFakeArchive()
      const deps = await depsAfter(ARCHIVE_DETAIL_AFTER_DAYS, { archive })
      await getSession(deps, request)
      await chmod(metaPath(), 0o600)

      await getSession(deps, request)

      expect(archive.detailSaves).toHaveLength(1)
    }
  )
})
