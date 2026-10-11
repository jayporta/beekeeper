import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorWithCode } from '../../../core/shared/testErrorWithCode'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { listSessions } from '../../../service/sessions/listSessions'
import { registerServiceTestTree, TEST_PROJECT } from '../../../service/testServiceTree'
import { guardArchive } from '../guardArchive'

const ctx = registerServiceTestTree()

afterEach(() => {
  vi.restoreAllMocks()
})

function list(archive: ReturnType<typeof guardArchive> | null): ReturnType<typeof listSessions> {
  return listSessions({ ...ctx.deps, archive }, { projectDirName: TEST_PROJECT })
}

describe('listSessions with a failing archive behind guardArchive', () => {
  it('returns the same list when the archive throws, logging each kind once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = guardArchive(createFakeArchive(errorWithCode('ELIST_THROWS')))

    const withArchive = await list(archive)
    const without = await list(null)

    expect(withArchive).toEqual(without)
    expect(warn.mock.calls).toEqual([
      ['Beekeeper archive read failed (ELIST_THROWS).'],
      ['Beekeeper archive write failed (ELIST_THROWS).']
    ])
  })

  it('returns the live list and logs once when reading the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = guardArchive(createFakeArchive(errorWithCode('ELIST_READ_THROWS')))

    const withArchive = await list(archive)
    const without = await list(null)

    expect(withArchive).toEqual(without)
    expect(warn.mock.calls).toContainEqual(['Beekeeper archive read failed (ELIST_READ_THROWS).'])
  })
})
