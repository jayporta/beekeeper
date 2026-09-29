import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { err } from '../../../core/shared/result'
import {
  buildAgentSettingRecord,
  buildAssistantRecord,
  buildJsonlText,
  buildUserRecord
} from '../../../core/transcript/testFixtures'
import type { SessionTeamDto } from '../../../shared/ipc/sessionTeamDto'
import type { IpcDeps } from '../ipcDeps'
import { listSessionsHandler } from '../listSessionsHandler'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const AGENT_SESSION_ID = '2b2b2b2b-2222-4222-8222-22222222222c'
const BROKEN_SESSION_ID = '3c3c3c3c-3333-4333-8333-33333333333d'

/** Writes a transcript into the test project. */
async function writeTranscript(sessionId: string, records: readonly unknown[]): Promise<void> {
  const projectDir = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT)
  await writeFile(join(projectDir, `${sessionId}.jsonl`), buildJsonlText(records))
}

/** Writes the lead's transcript, which spawns `scout` into `team-1`, over the tree's session. */
async function writeLeadTranscript(): Promise<void> {
  await writeTranscript(TEST_SESSION_ID, [
    buildAssistantRecord(),
    buildUserRecord({
      extra: { toolUseResult: { status: 'teammate_spawned', name: 'scout', team_name: 'team-1' } }
    })
  ])
}

/** The records of a teammate transcript for `scout` in `team-1`. */
function scoutRecords(): unknown[] {
  return [
    buildAgentSettingRecord('Explore'),
    buildUserRecord({ extra: { agentName: 'scout', teamName: 'team-1' } })
  ]
}

/** Lists the test project's sessions with `deps` and maps each session id to its team entry. */
async function readTeams(
  deps: Pick<IpcDeps, 'projectsRoot' | 'summaryCache' | 'summaries'> = ctx.deps
): Promise<Map<string, SessionTeamDto | null>> {
  const result = await listSessionsHandler(deps, { projectDirName: TEST_PROJECT })

  return new Map(result.ok ? result.value.map((item) => [item.sessionId, item.team]) : [])
}

describe('listSessionsHandler team', () => {
  it('sends no team for a solo lead', async () => {
    expect((await readTeams()).get(TEST_SESSION_ID)).toBeNull()
  })

  it('links a lead to its teammate and the teammate back to its lead', async () => {
    await writeLeadTranscript()
    await writeTranscript(AGENT_SESSION_ID, scoutRecords())

    const teams = await readTeams()

    expect(teams.get(TEST_SESSION_ID)).toEqual({
      kind: 'lead',
      teammateSessionIds: [AGENT_SESSION_ID],
      cost: {
        leadUSD: null,
        teamUSD: null,
        sessionsWithoutCost: 2,
        missingTeammates: 0,
        teamListsTruncated: false
      }
    })
    expect(teams.get(AGENT_SESSION_ID)).toEqual({
      kind: 'teammate',
      leadSessionId: TEST_SESSION_ID,
      joinedBy: 'spawn',
      stopped: false
    })
  })

  it('sends no team for a session whose summary could not be read, and leaves it out of grouping', async () => {
    await writeLeadTranscript()
    await writeTranscript(BROKEN_SESSION_ID, scoutRecords())
    const deps = {
      ...ctx.deps,
      summaryCache: {
        read: async (file: Parameters<IpcDeps['summaryCache']['read']>[0]) =>
          file.path.endsWith(`${BROKEN_SESSION_ID}.jsonl`)
            ? err({ reason: 'unreadable' as const, code: 'EACCES' })
            : ctx.deps.summaryCache.read(file)
      }
    }

    const teams = await readTeams(deps)

    expect(teams.get(BROKEN_SESSION_ID)).toBeNull()
    expect(teams.get(TEST_SESSION_ID)).toMatchObject({
      teammateSessionIds: [],
      cost: { missingTeammates: 1 }
    })
  })
})
