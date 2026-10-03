import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  buildAgentSettingRecord,
  buildAssistantRecord,
  buildUserRecord
} from '../../../core/transcript/testFixtures'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { IpcDeps } from '../ipcDeps'
import { listProjectsHandler } from '../listProjectsHandler'
import { listSessionsHandler } from '../listSessionsHandler'
import {
  AGENT_SESSION_ID,
  HUMAN_SESSION_ID,
  WORKTREE,
  scoutRecords,
  writeLead,
  writeTranscript
} from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const STRAY_SESSION_ID = '5e5e5e5e-5555-4555-8555-55555555555f'

/** Writes the `scout` teammate transcript into a folder. */
async function writeScout(projectDirName: string): Promise<void> {
  await writeTranscript(ctx.tree.home, {
    projectDirName,
    sessionId: AGENT_SESSION_ID,
    records: scoutRecords()
  })
}

async function listFolder(projectDirName: string): Promise<readonly SessionListItemDto[]> {
  const result = await listSessionsHandler(ctx.deps, { projectDirName })
  if (!result.ok) throw new Error(`listing ${projectDirName} failed`)
  return result.value
}

const leadRef = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

describe('listSessionsHandler project family', () => {
  it('lists a teammate from a worktree folder under its lead in the parent folder', async () => {
    await writeLead(ctx.tree.home)
    await writeScout(WORKTREE)

    const items = await listFolder(TEST_PROJECT)

    expect(items.map((item) => [item.projectDirName, item.sessionId])).toEqual([
      [TEST_PROJECT, TEST_SESSION_ID],
      [WORKTREE, AGENT_SESSION_ID]
    ])
    expect(items[0]?.team).toMatchObject({
      kind: 'lead',
      teammates: [{ projectDirName: WORKTREE, sessionId: AGENT_SESSION_ID }]
    })
    expect(items[1]?.team).toMatchObject({ kind: 'teammate', lead: leadRef })
  })

  it('lists the same teammate in its own folder with the same lead', async () => {
    await writeLead(ctx.tree.home)
    await writeScout(WORKTREE)

    const items = await listFolder(WORKTREE)

    expect(items.map((item) => [item.projectDirName, item.sessionId])).toEqual([
      [WORKTREE, AGENT_SESSION_ID]
    ])
    expect(items[0]?.team).toMatchObject({ kind: 'teammate', lead: leadRef, joinedBy: 'spawn' })
  })

  it('leaves out a worktree folder session that is not a teammate of the folder leads', async () => {
    await writeLead(ctx.tree.home)
    await writeScout(WORKTREE)
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: HUMAN_SESSION_ID,
      records: [buildAssistantRecord()]
    })
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: STRAY_SESSION_ID,
      records: [
        buildAgentSettingRecord('Explore'),
        buildUserRecord({ extra: { agentName: 'stray', teamName: 'team-2' } })
      ]
    })

    const items = await listFolder(TEST_PROJECT)

    expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID, AGENT_SESSION_ID])
  })

  it.skipIf(process.getuid?.() === 0)(
    'lists the requested folder when a sibling family folder cannot be read',
    async () => {
      await writeLead(ctx.tree.home)
      await writeScout(WORKTREE)
      const unreadable = join(ctx.tree.home, '.claude', 'projects', WORKTREE)
      await chmod(unreadable, 0o000)

      try {
        const items = await listFolder(TEST_PROJECT)

        expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID])
        expect(items[0]?.team).toMatchObject({ kind: 'lead', usage: { missingTeammates: 1 } })
      } finally {
        await chmod(unreadable, 0o755)
      }
    }
  )

  it.skipIf(process.getuid?.() === 0)(
    'logs only the error code when a sibling family folder cannot be read',
    async () => {
      await writeLead(ctx.tree.home)
      await writeScout(WORKTREE)
      const unreadable = join(ctx.tree.home, '.claude', 'projects', WORKTREE)
      await chmod(unreadable, 0o000)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        await listFolder(TEST_PROJECT)

        expect(warn.mock.calls).toEqual([['Beekeeper skipped a project family folder (EACCES).']])
      } finally {
        await chmod(unreadable, 0o755)
        vi.restoreAllMocks()
      }
    }
  )

  it('fails when a sibling family folder scan throws an error with no system code', async () => {
    await writeLead(ctx.tree.home)
    await writeScout(WORKTREE)
    const deps: IpcDeps = {
      ...ctx.deps,
      summaryCache: {
        read: (file) =>
          file.path.includes(WORKTREE)
            ? Promise.reject(new TypeError('bug'))
            : ctx.deps.summaryCache.read(file)
      }
    }

    await expect(listSessionsHandler(deps, { projectDirName: TEST_PROJECT })).rejects.toThrow(
      TypeError
    )
  })

  it.skipIf(process.getuid?.() === 0)(
    'fails when the requested folder cannot be read',
    async () => {
      await writeLead(ctx.tree.home)
      const unreadable = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT)
      await chmod(unreadable, 0o000)

      try {
        await expect(listFolder(TEST_PROJECT)).rejects.toThrow()
      } finally {
        await chmod(unreadable, 0o755)
      }
    }
  )

  it('leaves a worktree teammate ungrouped when its lead is absent', async () => {
    await writeScout(WORKTREE)

    const items = await listFolder(WORKTREE)

    expect(items).toHaveLength(1)
    expect(items[0]?.team).toEqual({ kind: 'ungrouped', teamName: 'team-1' })
  })

  it('lists a human session in a worktree folder normally and marks the folder', async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: HUMAN_SESSION_ID,
      records: [buildAssistantRecord()]
    })

    const items = await listFolder(WORKTREE)
    const projects = await listProjectsHandler(ctx.deps)

    expect(items.map((item) => [item.projectDirName, item.sessionId, item.team])).toEqual([
      [WORKTREE, HUMAN_SESSION_ID, null]
    ])
    expect(projects).toEqual({
      ok: true,
      value: [
        { dirName: TEST_PROJECT, label: null, worktreeOf: null },
        { dirName: WORKTREE, label: null, worktreeOf: TEST_PROJECT }
      ]
    })
  })

  it('answers not-found for an unlisted folder even when a family exists', async () => {
    await writeScout(WORKTREE)

    const result = await listSessionsHandler(ctx.deps, { projectDirName: `${TEST_PROJECT}-nope` })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})
