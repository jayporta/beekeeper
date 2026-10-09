import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { err } from '../../../core/shared/result'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { testListItem, testOkSummary } from '../../archive/testArchiveFixtures'
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

  it("saves a project's sessions in one batch", async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: TEST_PROJECT,
      sessionId: AGENT_SESSION_ID,
      records: scoutRecords()
    })
    const archive = createFakeArchiveWriter()

    await list({ ...ctx.deps, archive })

    expect(archive.listBatches.map((batch) => batch.length)).toEqual([2])
  })

  it('saves nothing, not even an empty batch, when no session has a readable summary', async () => {
    const archive = createFakeArchiveWriter()
    const deps: IpcDeps = {
      ...ctx.deps,
      archive,
      summaryCache: { read: () => Promise.resolve(err({ reason: 'unreadable', code: 'EIO' })) }
    }

    await list(deps)

    expect(archive.listBatches).toEqual([])
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
    expect(warn.mock.calls).toEqual([
      ['Beekeeper archive write failed (ELIST_THROWS).'],
      ['Beekeeper archive read failed (ELIST_THROWS).']
    ])
  })
})

const GONE_ID = '9f9f9f9f-9999-4999-8999-99999999999a'
const OTHER_GONE_ID = '8e8e8e8e-8888-4888-8888-88888888888b'

/** An archived list item of the test project whose transcript is gone. */
function archivedItem(
  sessionId: string,
  overrides: Partial<SessionListItemDto> = {}
): SessionListItemDto {
  return testListItem({
    projectDirName: TEST_PROJECT,
    sessionId,
    summary: testOkSummary(5),
    ...overrides
  })
}

async function listOk(deps: IpcDeps): Promise<readonly SessionListItemDto[]> {
  const result = await list(deps)
  if (!result.ok) throw new Error('listing failed')
  return result.value
}

describe('listSessionsHandler archived sessions', () => {
  it('marks live sessions as not archived', async () => {
    const items = await listOk({ ...ctx.deps, archive: createFakeArchiveWriter() })

    expect(items.map((item) => item.archived)).toEqual([false])
  })

  it('appends an archived session whose transcript is gone, marked archived', async () => {
    const archive = createFakeArchiveWriter(undefined, { listItems: [archivedItem(GONE_ID)] })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items.map((item) => [item.sessionId, item.archived])).toEqual([
      [TEST_SESSION_ID, false],
      [GONE_ID, true]
    ])
  })

  it('keeps the archived item as stored, apart from the archived flag', async () => {
    const stored = archivedItem(GONE_ID)
    const archive = createFakeArchiveWriter(undefined, { listItems: [stored] })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items[1]).toEqual({ ...stored, archived: true })
  })

  it('sends an archived session without a team', async () => {
    const team = {
      kind: 'ungrouped',
      teamName: 'team-1'
    } as const
    const archive = createFakeArchiveWriter(undefined, {
      listItems: [archivedItem(GONE_ID, { team })]
    })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items[1]?.team).toBeNull()
  })

  it('lets the live session win over an archived copy of the same id', async () => {
    const archive = createFakeArchiveWriter(undefined, {
      listItems: [archivedItem(TEST_SESSION_ID), archivedItem(GONE_ID)]
    })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items.map((item) => [item.sessionId, item.archived])).toEqual([
      [TEST_SESSION_ID, false],
      [GONE_ID, true]
    ])
  })

  it('does not append archived sessions of another folder', async () => {
    const archive = createFakeArchiveWriter(undefined, {
      listItems: [archivedItem(GONE_ID, { projectDirName: WORKTREE })]
    })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID])
  })

  it('appends an archived session whose subagents folder remains on disk', async () => {
    const subagents = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT, GONE_ID, 'subagents')
    await mkdir(subagents, { recursive: true })
    await writeFile(join(subagents, 'agent-a1.jsonl'), '')
    const archive = createFakeArchiveWriter(undefined, { listItems: [archivedItem(GONE_ID)] })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items.map((item) => [item.sessionId, item.archived])).toEqual([
      [TEST_SESSION_ID, false],
      [GONE_ID, true]
    ])
  })

  it("counts only the folder's own sessions as live, not a teammate listed from another folder", async () => {
    await writeLead(ctx.tree.home)
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: AGENT_SESSION_ID,
      records: scoutRecords()
    })
    const archive = createFakeArchiveWriter(undefined, {
      listItems: [archivedItem(AGENT_SESSION_ID)]
    })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items.map((item) => [item.projectDirName, item.sessionId, item.archived])).toEqual([
      [TEST_PROJECT, TEST_SESSION_ID, false],
      [WORKTREE, AGENT_SESSION_ID, false],
      [TEST_PROJECT, AGENT_SESSION_ID, true]
    ])
  })

  it('appends several archived sessions in the order the archive gives them', async () => {
    const archive = createFakeArchiveWriter(undefined, {
      listItems: [archivedItem(GONE_ID), archivedItem(OTHER_GONE_ID)]
    })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items.slice(1).map((item) => item.sessionId)).toEqual([GONE_ID, OTHER_GONE_ID])
  })

  it('leaves grouping untouched: an archived teammate does not join its live lead', async () => {
    await writeLead(ctx.tree.home)
    const archive = createFakeArchiveWriter(undefined, {
      listItems: [archivedItem(AGENT_SESSION_ID)]
    })

    const items = await listOk({ ...ctx.deps, archive })

    expect(items[0]?.team).toMatchObject({ kind: 'lead', usage: { missingTeammates: 1 } })
    expect(items[1]).toMatchObject({ sessionId: AGENT_SESSION_ID, archived: true, team: null })
  })

  it('still answers not-found for a project folder that is gone', async () => {
    const archive = createFakeArchiveWriter(undefined, { listItems: [archivedItem(GONE_ID)] })

    const result = await listSessionsHandler(
      { ...ctx.deps, archive },
      { projectDirName: '-no-such-project' }
    )

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })

  it('returns the live list and logs once when reading the archive throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const archive = createFakeArchiveWriter(errorWithCode('ELIST_READ_THROWS'))

    const withArchive = await list({ ...ctx.deps, archive })
    const without = await list({ ...ctx.deps, archive: null })

    expect(withArchive).toEqual(without)
    expect(warn.mock.calls).toContainEqual(['Beekeeper archive read failed (ELIST_READ_THROWS).'])
  })
})
