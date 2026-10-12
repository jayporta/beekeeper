import { describe, expect, it } from 'vitest'
import { testSpawn, testTeamSpawns } from '../../../core/teams/testTeamFixtures'
import { testArchivedSession, testListItem } from '../../archive/testArchiveFixtures'
import { NO_TEAM_SPAWNS, summarizeArchivedSession } from '../summarizeArchivedSession'

const ID = '11111111-1111-4111-8111-111111111111'

describe('summarizeArchivedSession', () => {
  it('takes the ref and the grouping fields from the item and the stored spawns', () => {
    const spawns = testTeamSpawns([testSpawn('scout', 'blue')])

    const summarized = summarizeArchivedSession(
      testArchivedSession(ID, { projectDirName: '-p', teamSpawns: spawns })
    )

    expect(summarized?.ref).toEqual({ projectDirName: '-p', sessionId: ID })
    expect(summarized?.summary).toMatchObject({
      role: { kind: 'lead' },
      activity: { earliestMs: 1, latestMs: 5 },
      teamSpawns: spawns
    })
  })

  it('reads missing stored spawns as spawning nobody', () => {
    const summarized = summarizeArchivedSession(testArchivedSession(ID, { teamSpawns: null }))

    expect(summarized?.summary.teamSpawns).toEqual(NO_TEAM_SPAWNS)
  })

  it('answers null for an item whose summary is unreadable', () => {
    expect(summarizeArchivedSession({ item: testListItem(), teamSpawns: null })).toBeNull()
  })

  it('builds the same session object once for the same archived session', () => {
    const session = testArchivedSession(ID)

    expect(summarizeArchivedSession(session)).toBe(summarizeArchivedSession(session))
  })

  it('remembers an unreadable summary too, without rebuilding it', () => {
    const session = { item: testListItem(), teamSpawns: null }
    let reads = 0
    const counted = {
      ...session,
      get item() {
        reads += 1
        return session.item
      }
    }

    summarizeArchivedSession(counted)
    summarizeArchivedSession(counted)

    expect(reads).toBe(1)
  })
})
