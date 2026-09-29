import { describe, expect, it } from 'vitest'
import type { SessionRoleDto } from '../../../shared/ipc/sessionRoleDto'
import { listSessionsHandler } from '../listSessionsHandler'
import { AGENT_SESSION_ID, scoutRecords, writeTranscript } from '../testFamilyFixtures'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

/** Lists the test project's sessions and maps each session id to the role it was sent. */
async function readRoles(): Promise<Map<string, SessionRoleDto | null>> {
  const result = await listSessionsHandler(ctx.deps, { projectDirName: TEST_PROJECT })

  return new Map(
    result.ok
      ? result.value.map((item) => [
          item.sessionId,
          item.summary.ok ? item.summary.value.role : null
        ])
      : []
  )
}

/** Writes a teammate's own top-level transcript into the test project. */
async function writeAgentTranscript(): Promise<void> {
  await writeTranscript(ctx.tree.home, {
    projectDirName: TEST_PROJECT,
    sessionId: AGENT_SESSION_ID,
    records: scoutRecords()
  })
}

describe('listSessionsHandler role', () => {
  it('sends a lead role for a session with no agent markers', async () => {
    expect((await readRoles()).get(TEST_SESSION_ID)).toEqual({ kind: 'lead' })
  })

  it("sends an agent role carrying a teammate's type, name, and team", async () => {
    await writeAgentTranscript()

    expect((await readRoles()).get(AGENT_SESSION_ID)).toEqual({
      kind: 'agent',
      agentType: 'Explore',
      agentName: 'scout',
      teamName: 'team-1'
    })
  })
})
