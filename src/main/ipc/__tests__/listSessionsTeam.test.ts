import { describe, expect, it } from 'vitest'
import { err } from '../../../core/shared/result'
import type { SessionTeamDto } from '../../../shared/ipc/sessionTeamDto'
import type { IpcDeps } from '../ipcDeps'
import { listSessionsHandler } from '../listSessionsHandler'
import { AGENT_SESSION_ID, scoutRecords, writeLead, writeTranscript } from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const BROKEN_SESSION_ID = '3c3c3c3c-3333-4333-8333-33333333333d'

/** Writes the `scout` teammate transcript into the test project. */
async function writeScoutInProject(sessionId: string): Promise<void> {
  await writeTranscript(ctx.tree.home, {
    projectDirName: TEST_PROJECT,
    sessionId,
    records: scoutRecords()
  })
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
    await writeLead(ctx.tree.home)
    await writeScoutInProject(AGENT_SESSION_ID)

    const teams = await readTeams()

    expect(teams.get(TEST_SESSION_ID)).toEqual({
      kind: 'lead',
      teammates: [{ projectDirName: TEST_PROJECT, sessionId: AGENT_SESSION_ID }],
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
      lead: { projectDirName: TEST_PROJECT, sessionId: TEST_SESSION_ID },
      joinedBy: 'spawn',
      stopped: false
    })
  })

  it('sends no team for a session whose summary could not be read, and leaves it out of grouping', async () => {
    await writeLead(ctx.tree.home)
    await writeScoutInProject(BROKEN_SESSION_ID)
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
      teammates: [],
      cost: { missingTeammates: 1 }
    })
  })
})
