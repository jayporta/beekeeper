import { describe, expect, it } from 'vitest'
import { ok } from '../../../core/shared/result'
import { toProjectDirName, toSessionId } from '../../../core/transcript/ids'
import {
  buildSessionSummary,
  EMPTY_LEAD_USAGE
} from '../../../core/transcript/summary/testSessionSummary'
import type { LeadUsage } from '../../../core/transcript/summary/leadUsage'
import { NO_AGENT_TERMS } from '../../../core/session/agentSearchTerms'
import { testSpawn, testStop, testTeamSpawns } from '../../../core/teams/testTeamFixtures'
import { createFakeArchive } from '../../../service/archive/testFakeArchive'
import { archiveListedSessions } from '../archiveListedSessions'
import { mapSessionListItem, type ListableSession } from '../mapSessionListItem'
import { NO_WORKFLOW_RUN_NAMES } from '../readSessionWorkflowRunNames'

const FOLDER = '-Users-a-repo'

function listable(summary: ListableSession['summary']): ListableSession {
  return {
    projectDirName: toProjectDirName(FOLDER),
    entry: {
      sessionId: toSessionId('11111111-1111-4111-8111-111111111111'),
      sessionDir: '/x/11111111-1111-4111-8111-111111111111',
      transcript: ok({ path: '/x/s.jsonl', mtimeMs: 10, size: 20, ino: 1, dev: 1 }),
      subagents: ok([])
    },
    summary,
    agentTerms: NO_AGENT_TERMS,
    workflowRunNames: NO_WORKFLOW_RUN_NAMES
  }
}

/** Archives one listed session with the given summary fields and returns what the archive received. */
function archiveOne(
  overrides: Parameters<typeof buildSessionSummary>[0]
): ReturnType<typeof createFakeArchive>['listSaves'] {
  const archive = createFakeArchive()
  const session = listable(ok(buildSessionSummary(overrides)))
  archiveListedSessions({
    archive,
    projectDirName: FOLDER,
    listed: [{ session, item: mapSessionListItem(session, null) }]
  })
  return archive.listSaves
}

describe('archiveListedSessions sidecars', () => {
  it('passes the teammates the scanned summary spawned and stopped', () => {
    const teamSpawns = testTeamSpawns([testSpawn('scout', 'blue')], [testStop('scout', 'blue')])

    const [save] = archiveOne({ teamSpawns })

    expect(save?.teamSpawns).toEqual(teamSpawns)
  })

  it('passes the lead usage slots and counts without the message ids', () => {
    const leadUsage: LeadUsage = {
      slots: [{ slot: 7, model: 'claude-opus-5', tokens: 100 }],
      undatedMessages: 2,
      invalidAssistantRecords: 1,
      messageIds: new Set(['msg_1'])
    }

    const [save] = archiveOne({ leadUsage })

    expect(save?.leadSlots).toEqual({
      slots: [{ slot: 7, model: 'claude-opus-5', tokens: 100 }],
      undatedMessages: 2,
      invalidAssistantRecords: 1
    })
    expect(save?.leadSlots).not.toHaveProperty('messageIds')
  })

  it('passes empty lead slots for a transcript with no usage', () => {
    const [save] = archiveOne({ leadUsage: EMPTY_LEAD_USAGE })

    expect(save?.leadSlots).toEqual({ slots: [], undatedMessages: 0, invalidAssistantRecords: 0 })
  })

  it('passes null lead slots for a scan that held more messages than it keeps', () => {
    const [save] = archiveOne({ leadUsage: null })

    expect(save?.leadSlots).toBeNull()
  })
})
