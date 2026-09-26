import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildAgentSettingRecord,
  buildJsonlText,
  buildUserRecord
} from '../../../core/transcript/testFixtures'
import type { SessionRoleDto } from '../../../shared/ipc/sessionRoleDto'
import { listSessionsHandler } from '../listSessionsHandler'
import { TEST_PROJECT, TEST_SESSION_ID, registerIpcTestTree } from '../testIpcTree'

const ctx = registerIpcTestTree()

const AGENT_SESSION_ID = '2b2b2b2b-2222-4222-8222-22222222222c'

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
  const projectDir = join(ctx.tree.home, '.claude', 'projects', TEST_PROJECT)
  await writeFile(
    join(projectDir, `${AGENT_SESSION_ID}.jsonl`),
    buildJsonlText([
      buildAgentSettingRecord('Explore'),
      buildUserRecord({ extra: { agentName: 'scout', teamName: 'team-1' } })
    ])
  )
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
