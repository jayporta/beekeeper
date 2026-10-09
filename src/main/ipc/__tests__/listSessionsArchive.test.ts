import { afterEach, describe, expect, it, vi } from 'vitest'
import { err } from '../../../core/shared/result'
import { createFakeArchiveWriter } from '../../archive/testFakeArchiveWriter'
import { errorWithCode } from '../../testErrorWithCode'
import type { IpcDeps } from '../ipcDeps'
import { listSessionsHandler } from '../listSessionsHandler'
import {
  AGENT_SESSION_ID,
  scoutRecords,
  WORKTREE,
  writeLead,
  writeTranscript
} from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

afterEach(() => {
  vi.restoreAllMocks()
})

function list(deps: IpcDeps): ReturnType<typeof listSessionsHandler> {
  return listSessionsHandler(deps, { projectDirName: TEST_PROJECT })
}

describe('listSessionsHandler archive', () => {
  it('saves each listed session with its transcript state', async () => {
    const archive = createFakeArchiveWriter()

    const result = await list({ ...ctx.deps, archive })

    const [save] = archive.listSaves
    expect(archive.listSaves).toHaveLength(1)
    expect(result.ok && result.value[0]).toEqual(save?.item)
    expect(save?.source).toEqual({
      mtimeMs: save?.item.modifiedMs,
      size: save?.item.sizeBytes
    })
  })

  it('lists without touching an archive when none is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await list({ ...ctx.deps, archive: null })

    expect(result.ok).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('saves only the sessions whose summary could be read', async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: TEST_PROJECT,
      sessionId: AGENT_SESSION_ID,
      records: scoutRecords()
    })
    const archive = createFakeArchiveWriter()
    const deps: IpcDeps = {
      ...ctx.deps,
      archive,
      summaryCache: {
        read: (file) =>
          file.path.includes(AGENT_SESSION_ID)
            ? Promise.resolve(err({ reason: 'unreadable', code: 'EIO' }))
            : ctx.deps.summaryCache.read(file)
      }
    }

    const result = await list(deps)

    expect(result.ok && result.value.map((item) => item.sessionId).sort()).toEqual(
      [TEST_SESSION_ID, AGENT_SESSION_ID].sort()
    )
    expect(archive.listSaves.map((save) => save.item.sessionId)).toEqual([TEST_SESSION_ID])
  })

  it('does not save a teammate listed here from another folder of the family', async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: AGENT_SESSION_ID,
      records: scoutRecords()
    })
    await writeLead(ctx.tree.home)
    const archive = createFakeArchiveWriter()

    const result = await list({ ...ctx.deps, archive })

    expect(result.ok && result.value.map((item) => item.projectDirName)).toContain(WORKTREE)
    expect(archive.listSaves.map((save) => save.item.projectDirName)).toEqual([TEST_PROJECT])
  })

  it('returns the same list when the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = createFakeArchiveWriter(errorWithCode('ELIST_THROWS'))

    const withArchive = await list({ ...ctx.deps, archive })
    const without = await list({ ...ctx.deps, archive: null })

    expect(withArchive).toEqual(without)
    expect(warn.mock.calls).toEqual([['Beekeeper archive write failed (ELIST_THROWS).']])
  })
})
