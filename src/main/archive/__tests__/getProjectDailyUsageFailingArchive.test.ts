import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorWithCode } from '../../../core/shared/testErrorWithCode'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { getProjectDailyUsage } from '../../../service/overview/getProjectDailyUsage'
import { registerServiceTestTree, TEST_PROJECT } from '../../../service/testServiceTree'
import { guardArchive } from '../guardArchive'

const ctx = registerServiceTestTree()
const request = { projectDirName: TEST_PROJECT, window: '7d' } as const

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getProjectDailyUsage with a failing archive behind guardArchive', () => {
  it('returns the same usage, logging the failure once, when the archive cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = guardArchive(createFakeArchive(errorWithCode('EDAILYFAIL')))

    const guarded = await getProjectDailyUsage({ ...ctx.deps, archive }, request)
    const plain = await getProjectDailyUsage({ ...ctx.deps, archive: null }, request)

    expect(guarded).toEqual(plain)
    expect(warn.mock.calls).toEqual([['Beekeeper archive read failed (EDAILYFAIL).']])
  })
})
