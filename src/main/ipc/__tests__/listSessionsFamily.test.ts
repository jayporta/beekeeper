import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildAgentSettingRecord,
  buildAssistantRecord,
  buildJsonlText,
  buildUserRecord
} from '../../../core/transcript/testFixtures'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import { listProjectsHandler } from '../listProjectsHandler'
import { listSessionsHandler } from '../listSessionsHandler'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const WORKTREE = `${TEST_PROJECT}--claude-worktrees-feat`
const AGENT_SESSION_ID = '2b2b2b2b-2222-4222-8222-22222222222c'
const STRAY_SESSION_ID = '5e5e5e5e-5555-4555-8555-55555555555f'
const HUMAN_SESSION_ID = '4d4d4d4d-4444-4444-8444-44444444444e'

/** Writes a transcript into a project folder under the test tree, creating the folder. */
async function writeTranscript(
  projectDirName: string,
  sessionId: string,
  records: readonly unknown[]
): Promise<void> {
  const dir = join(ctx.tree.home, '.claude', 'projects', projectDirName)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${sessionId}.jsonl`), buildJsonlText(records))
}

/** Writes the lead in the base folder, which spawns `scout` into `team-1`. */
async function writeLead(): Promise<void> {
  await writeTranscript(TEST_PROJECT, TEST_SESSION_ID, [
    buildAssistantRecord(),
    buildUserRecord({
      extra: { toolUseResult: { status: 'teammate_spawned', name: 'scout', team_name: 'team-1' } }
    })
  ])
}

/** Writes the `scout` teammate transcript into a folder. */
async function writeScout(projectDirName: string): Promise<void> {
  await writeTranscript(projectDirName, AGENT_SESSION_ID, [
    buildAgentSettingRecord('Explore'),
    buildUserRecord({ extra: { agentName: 'scout', teamName: 'team-1' } })
  ])
}

async function listFolder(projectDirName: string): Promise<readonly SessionListItemDto[]> {
  const result = await listSessionsHandler(ctx.deps, { projectDirName })
  if (!result.ok) throw new Error(`listing ${projectDirName} failed`)
  return result.value
}

const leadRef = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }

describe('listSessionsHandler project family', () => {
  it('lists a teammate from a worktree folder under its lead in the parent folder', async () => {
    await writeLead()
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
    await writeLead()
    await writeScout(WORKTREE)

    const items = await listFolder(WORKTREE)

    expect(items.map((item) => [item.projectDirName, item.sessionId])).toEqual([
      [WORKTREE, AGENT_SESSION_ID]
    ])
    expect(items[0]?.team).toMatchObject({ kind: 'teammate', lead: leadRef, joinedBy: 'spawn' })
  })

  it('leaves out a worktree folder session that is not a teammate of the folder leads', async () => {
    await writeLead()
    await writeScout(WORKTREE)
    await writeTranscript(WORKTREE, HUMAN_SESSION_ID, [buildAssistantRecord()])
    await writeTranscript(WORKTREE, STRAY_SESSION_ID, [
      buildAgentSettingRecord('Explore'),
      buildUserRecord({ extra: { agentName: 'stray', teamName: 'team-2' } })
    ])

    const items = await listFolder(TEST_PROJECT)

    expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID, AGENT_SESSION_ID])
  })

  it.skipIf(process.getuid?.() === 0)(
    'lists the requested folder when a sibling family folder cannot be read',
    async () => {
      await writeLead()
      await writeScout(WORKTREE)
      const unreadable = join(ctx.tree.home, '.claude', 'projects', WORKTREE)
      await chmod(unreadable, 0o000)

      try {
        const items = await listFolder(TEST_PROJECT)

        expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID])
        expect(items[0]?.team).toMatchObject({ kind: 'lead', cost: { missingTeammates: 1 } })
      } finally {
        await chmod(unreadable, 0o755)
      }
    }
  )

  it.skipIf(process.getuid?.() === 0)(
    'fails when the requested folder cannot be read',
    async () => {
      await writeLead()
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
    await writeTranscript(WORKTREE, HUMAN_SESSION_ID, [buildAssistantRecord()])

    const items = await listFolder(WORKTREE)
    const projects = await listProjectsHandler(ctx.deps)

    expect(items.map((item) => [item.projectDirName, item.sessionId, item.team])).toEqual([
      [WORKTREE, HUMAN_SESSION_ID, null]
    ])
    expect(projects).toEqual({
      ok: true,
      value: [
        { dirName: TEST_PROJECT, worktreeOf: null },
        { dirName: WORKTREE, worktreeOf: TEST_PROJECT }
      ]
    })
  })

  it('answers not-found for an unlisted folder even when a family exists', async () => {
    await writeScout(WORKTREE)

    const result = await listSessionsHandler(ctx.deps, { projectDirName: `${TEST_PROJECT}-nope` })

    expect(result).toEqual({ ok: false, error: { code: 'not-found' } })
  })
})
