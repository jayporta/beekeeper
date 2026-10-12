import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorWithCode } from '../../../core/shared/testErrorWithCode'
import { ARCHIVE_DETAIL_AFTER_DAYS, DAY_MS } from '../../../service/archive/archiveDetailTiming'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { getSession } from '../../../service/sessionDetail/getSession'
import {
  registerServiceTestTree,
  TEST_PROJECT,
  TEST_SESSION_ID
} from '../../../service/testServiceTree'
import { guardArchive } from '../guardArchive'
import { stat } from 'node:fs/promises'

const ctx = registerServiceTestTree()
const request = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }
const GONE_REF = { projectDirName: TEST_PROJECT, sessionId: '9f9f9f9f-9999-4999-8999-99999999999a' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getSession with a failing archive behind guardArchive', () => {
  it('returns the same detail when the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = guardArchive(createFakeArchive(errorWithCode('EDETAIL_THROWS')))
    const { mtimeMs } = await stat(ctx.tree.sessionPath)
    const now = (): number => Math.max(mtimeMs, Date.now()) + ARCHIVE_DETAIL_AFTER_DAYS * DAY_MS

    const guarded = await getSession({ ...ctx.deps, now, archive }, request)
    const plain = await getSession({ ...ctx.deps, now, archive: null }, request)

    expect(guarded).toEqual(plain)
    expect(warn.mock.calls).toEqual([['Beekeeper archive write failed (EDETAIL_THROWS).']])
  })

  it('answers not-found and logs once when reading the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = guardArchive(createFakeArchive(errorWithCode('EDETAIL_READ_THROWS')))

    const result = await getSession({ ...ctx.deps, archive }, GONE_REF)

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
    expect(warn.mock.calls).toEqual([['Beekeeper archive read failed (EDETAIL_READ_THROWS).']])
  })
})
