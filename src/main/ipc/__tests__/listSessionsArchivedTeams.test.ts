import { chmod } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { testSpawn, testTeamSpawns } from '../../../core/teams/testTeamFixtures'
import { buildAssistantRecord } from '../../../core/transcript/testFixtures'
import type { SessionListItemDto } from '../../../shared/ipc/sessionListDto'
import type { SessionRoleDto } from '../../../shared/ipc/sessionRoleDto'
import { testArchivedSession as archivedSession } from '../../archive/testArchiveFixtures'
import { createFakeArchive, type FakeArchive } from '../../../service/archive/testFakeArchive'
import type { ArchivedSession } from '../../../service/archive/archivePort'
import { listSessionsHandler } from '../listSessionsHandler'
import {
  AGENT_SESSION_ID,
  HUMAN_SESSION_ID,
  scoutRecords,
  WORKTREE,
  writeLead,
  writeTranscript
} from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

/** The id of a session that is only in the archive, as a lead. */
const ARCHIVED_LEAD_ID = '6f6f6f6f-6666-4666-8666-66666666666a'
/** The role the `scout` teammate's transcript has. */
const SCOUT: SessionRoleDto = {
  kind: 'agent',
  agentType: 'Explore',
  agentName: 'scout',
  teamName: 'team-1'
}
/** An activity span that ends after any teammate starts, since a lead that ended earlier can't own it. */
const STILL_ACTIVE = { earliestMs: 1, latestMs: 4_000_000_000_000 }
const LEAD_REF = { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID }
const SCOUT_SPAWNS = testTeamSpawns([testSpawn('scout', 'team-1')])

/** An archived session of the test project, unless the options name another folder. */
function archivedIn(
  sessionId: string,
  options: Parameters<typeof archivedSession>[1] = {}
): ArchivedSession {
  return archivedSession(sessionId, { projectDirName: TEST_PROJECT, ...options })
}

/** An archive holding `sessions`. */
function archiveOf(...sessions: ArchivedSession[]): FakeArchive {
  return createFakeArchive(undefined, { sessions })
}

async function listFolder(
  archive: FakeArchive,
  projectDirName = TEST_PROJECT
): Promise<readonly SessionListItemDto[]> {
  const result = await listSessionsHandler({ ...ctx.deps, archive }, { projectDirName })
  if (!result.ok) throw new Error(`listing ${projectDirName} failed`)
  return result.value
}

function itemOf(items: readonly SessionListItemDto[], sessionId: string): SessionListItemDto {
  const item = items.find((candidate) => candidate.sessionId === sessionId)
  if (item === undefined) throw new Error(`session ${sessionId} is not listed`)
  return item
}

/** Writes the live `scout` teammate transcript into a folder. */
async function writeScout(projectDirName: string): Promise<void> {
  await writeTranscript(ctx.tree.home, {
    projectDirName,
    sessionId: AGENT_SESSION_ID,
    records: scoutRecords()
  })
}

describe('listSessionsHandler archived teammates', () => {
  it('groups an archived teammate under a live lead, which then misses no teammate', async () => {
    await writeLead(ctx.tree.home)

    const items = await listFolder(archiveOf(archivedIn(AGENT_SESSION_ID, { role: SCOUT })))

    const scout = itemOf(items, AGENT_SESSION_ID)
    expect(scout.archived).toBe(true)
    expect(scout.team).toEqual({
      kind: 'teammate',
      lead: LEAD_REF,
      joinedBy: 'spawn',
      stopped: false
    })
    expect(itemOf(items, TEST_SESSION_ID).team).toMatchObject({
      kind: 'lead',
      teammates: [{ projectDirName: TEST_PROJECT, sessionId: AGENT_SESSION_ID }],
      usage: { missingTeammates: 0 }
    })
  })

  it('lists a sibling folder’s archived teammate under the lead, and in its own folder too', async () => {
    await writeLead(ctx.tree.home)
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: HUMAN_SESSION_ID,
      records: [buildAssistantRecord()]
    })
    const archive = archiveOf(
      archivedIn(AGENT_SESSION_ID, { role: SCOUT, projectDirName: WORKTREE })
    )

    const underLead = await listFolder(archive)
    const inOwnFolder = await listFolder(archive, WORKTREE)

    const expected = { kind: 'teammate', lead: LEAD_REF }
    expect(itemOf(underLead, AGENT_SESSION_ID)).toMatchObject({
      projectDirName: WORKTREE,
      archived: true,
      team: expected
    })
    expect(itemOf(inOwnFolder, AGENT_SESSION_ID).team).toMatchObject(expected)
  })

  it('does not list a sibling folder’s archived session that belongs to no lead of the folder', async () => {
    await writeTranscript(ctx.tree.home, {
      projectDirName: WORKTREE,
      sessionId: HUMAN_SESSION_ID,
      records: [buildAssistantRecord()]
    })
    const archive = archiveOf(
      archivedIn(AGENT_SESSION_ID, { role: SCOUT, projectDirName: WORKTREE })
    )

    const items = await listFolder(archive)

    expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID])
  })

  it('joins an archived teammate saved before spawns were kept to its live lead', async () => {
    await writeLead(ctx.tree.home)

    const items = await listFolder(
      archiveOf(archivedIn(AGENT_SESSION_ID, { role: SCOUT, teamSpawns: null }))
    )

    expect(itemOf(items, AGENT_SESSION_ID).team).toMatchObject({ kind: 'teammate' })
  })
})

describe('listSessionsHandler archived leads', () => {
  it('groups a live teammate under an archived lead, whose missing teammate count drops', async () => {
    await writeScout(TEST_PROJECT)
    const lead = archivedIn(ARCHIVED_LEAD_ID, { teamSpawns: SCOUT_SPAWNS, activity: STILL_ACTIVE })

    const items = await listFolder(archiveOf(lead))

    expect(itemOf(items, AGENT_SESSION_ID).team).toMatchObject({
      kind: 'teammate',
      lead: { projectDirName: TEST_PROJECT, sessionId: ARCHIVED_LEAD_ID },
      joinedBy: 'spawn'
    })
    expect(itemOf(items, ARCHIVED_LEAD_ID)).toMatchObject({
      archived: true,
      team: {
        kind: 'lead',
        teammates: [{ projectDirName: TEST_PROJECT, sessionId: AGENT_SESSION_ID }],
        usage: { missingTeammates: 0 }
      }
    })
  })

  it('counts a spawned teammate found nowhere as missing from an archived lead', async () => {
    const lead = archivedIn(ARCHIVED_LEAD_ID, { teamSpawns: SCOUT_SPAWNS })

    const items = await listFolder(archiveOf(lead))

    expect(itemOf(items, ARCHIVED_LEAD_ID).team).toMatchObject({
      kind: 'lead',
      usage: { missingTeammates: 1 }
    })
  })

  it('lets an archived lead saved before spawns were kept claim no teammate', async () => {
    await writeScout(TEST_PROJECT)
    const lead = archivedIn(ARCHIVED_LEAD_ID, { teamSpawns: null })

    const items = await listFolder(archiveOf(lead))

    expect(itemOf(items, ARCHIVED_LEAD_ID).team).toBeNull()
    expect(itemOf(items, AGENT_SESSION_ID).team).toEqual({ kind: 'ungrouped', teamName: 'team-1' })
  })
})

describe('listSessionsHandler archived rows of live sessions', () => {
  it('never lists the archived row of a session that is live in the requested folder', async () => {
    const stale = archivedIn(TEST_SESSION_ID)

    const items = await listFolder(archiveOf(stale))

    expect(items.filter((item) => item.sessionId === TEST_SESSION_ID)).toHaveLength(1)
    expect(itemOf(items, TEST_SESSION_ID).archived).toBe(false)
  })

  it('never lets the archived row of a live sibling-folder teammate join its lead a second time', async () => {
    await writeLead(ctx.tree.home)
    await writeScout(WORKTREE)
    const stale = archivedIn(AGENT_SESSION_ID, { role: SCOUT, projectDirName: WORKTREE })

    const items = await listFolder(archiveOf(stale))

    expect(items.filter((item) => item.sessionId === AGENT_SESSION_ID)).toHaveLength(1)
    expect(itemOf(items, AGENT_SESSION_ID).archived).toBe(false)
    expect(itemOf(items, TEST_SESSION_ID).team).toMatchObject({
      kind: 'lead',
      teammates: [{ projectDirName: WORKTREE, sessionId: AGENT_SESSION_ID }]
    })
  })
})

describe('listSessionsHandler archived rows of a sibling folder that could not be scanned', () => {
  it.skipIf(process.getuid?.() === 0)(
    'reads nothing from its archive, so copies of its live sessions do not join the lead',
    async () => {
      await writeLead(ctx.tree.home)
      await writeScout(WORKTREE)
      const archive = archiveOf(
        archivedIn(AGENT_SESSION_ID, { role: SCOUT, projectDirName: WORKTREE })
      )
      const read = vi.spyOn(archive, 'readSessions')
      const unreadable = join(ctx.tree.home, '.claude', 'projects', WORKTREE)
      await chmod(unreadable, 0o000)
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const items = await listFolder(archive)

        expect(items.map((item) => item.sessionId)).toEqual([TEST_SESSION_ID])
        expect(items[0]?.team).toMatchObject({ kind: 'lead', usage: { missingTeammates: 1 } })
        expect(read.mock.calls.map(([folder]) => folder)).not.toContain(WORKTREE)
      } finally {
        await chmod(unreadable, 0o755)
        vi.restoreAllMocks()
      }
    }
  )
})
