import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorWithCode } from '../../../core/shared/testErrorWithCode'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { getProjectTotals } from '../../../service/overview/getProjectTotals'
import { registerServiceTestTree, TEST_PROJECT } from '../../../service/testServiceTree'
import { guardArchive } from '../guardArchive'

const ctx = registerServiceTestTree()
const request = { projectDirName: TEST_PROJECT, window: '7d' } as const

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getProjectTotals with a failing archive behind guardArchive', () => {
  it('returns the same totals, logging the failure once, when the archive cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = guardArchive(createFakeArchive(errorWithCode('ETOTALSFAIL')))

    const guarded = await getProjectTotals({ ...ctx.deps, archive }, request)
    const plain = await getProjectTotals({ ...ctx.deps, archive: null }, request)

    expect(guarded).toEqual(plain)
    expect(warn.mock.calls).toEqual([['Beekeeper archive read failed (ETOTALSFAIL).']])
  })
})
