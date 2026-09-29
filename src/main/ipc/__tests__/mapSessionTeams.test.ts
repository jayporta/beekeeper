import { describe, expect, it } from 'vitest'
import { groupTeams } from '../../../core/teams/groupTeams'
import {
  testAgent,
  testCost,
  testLead,
  testRef,
  testSpawn,
  testStop,
  testTeamSpawns
} from '../../../core/teams/testTeamFixtures'
import type { SessionRefDto } from '../../../shared/ipc/sessionRefDto'
import { mapSessionTeams } from '../mapSessionTeams'
import { sessionRefKey } from '../sessionRefKey'

/** The map key of a session in the folder `p`. */
function key(sessionId: string, projectDirName = 'p'): string {
  return sessionRefKey({ projectDirName, sessionId })
}
const ref = (sessionId: string, projectDirName = 'p'): SessionRefDto => ({
  projectDirName,
  sessionId
})

describe('mapSessionTeams', () => {
  const lead = testLead(testRef('p', 'lead'), {
    cost: testCost(1),
    teamSpawns: testTeamSpawns(
      [testSpawn('a', 'team'), testSpawn('b', 'team'), testSpawn('ghost', 'team')],
      [testStop('a', 'team')]
    )
  })
  const a = testAgent(testRef('p', 'a'), { agentName: 'a', teamName: 'team', cost: testCost(2) })
  const b = testAgent(testRef('p', 'b'), { agentName: 'b', teamName: 'team' })

  it('maps a lead to its teammate refs in grouping order and a field-exact cost rollup', () => {
    const teams = mapSessionTeams(groupTeams([lead, b, a]))

    expect(teams.get(key('lead'))).toEqual({
      kind: 'lead',
      teammates: [ref('a'), ref('b')],
      cost: {
        leadUSD: 1,
        teamUSD: 3,
        sessionsWithoutCost: 1,
        missingTeammates: 1,
        teamListsTruncated: false
      }
    })
  })

  it('maps a stopped and an unstopped teammate to their lead with how they joined', () => {
    const teams = mapSessionTeams(groupTeams([lead, a, b]))

    expect(teams.get(key('a'))).toEqual({
      kind: 'teammate',
      lead: ref('lead'),
      joinedBy: 'spawn',
      stopped: true
    })
    expect(teams.get(key('b'))).toEqual({
      kind: 'teammate',
      lead: ref('lead'),
      joinedBy: 'spawn',
      stopped: false
    })
  })

  it('maps a teammate matched only by team as team-joined', () => {
    const teamLead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: 'team' })

    const teams = mapSessionTeams(groupTeams([teamLead, stray]))

    expect(teams.get(key('stray'))).toEqual({
      kind: 'teammate',
      lead: ref('lead'),
      joinedBy: 'team',
      stopped: false
    })
  })

  it('maps an ungrouped session to its team name', () => {
    const orphan = testAgent(testRef('p', 'orphan'), { agentName: 'orphan', teamName: 'team-x' })

    expect(mapSessionTeams(groupTeams([orphan])).get(key('orphan'))).toEqual({
      kind: 'ungrouped',
      teamName: 'team-x'
    })
  })

  it('maps an ungrouped session with no usable team to a null team name', () => {
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: null })

    expect(mapSessionTeams(groupTeams([stray])).get(key('stray'))).toEqual({
      kind: 'ungrouped',
      teamName: null
    })
  })

  it('gives a solo lead no entry', () => {
    const solo = testLead(testRef('p', 'solo'), { cost: testCost(5) })

    expect(mapSessionTeams(groupTeams([solo])).has(key('solo'))).toBe(false)
  })

  it('gives a lead with no teammates an entry when a spawned teammate never appeared', () => {
    const waiting = testLead(testRef('p', 'waiting'), {
      cost: testCost(5),
      teamSpawns: testTeamSpawns([testSpawn('ghost', 'team')])
    })

    expect(mapSessionTeams(groupTeams([waiting])).get(key('waiting'))).toEqual({
      kind: 'lead',
      teammates: [],
      cost: {
        leadUSD: 5,
        teamUSD: 5,
        sessionsWithoutCost: 0,
        missingTeammates: 1,
        teamListsTruncated: false
      }
    })
  })

  it('gives a lead with no teammates an entry when its spawns or stops hit their cap', () => {
    const capped = testLead(testRef('p', 'capped'), {
      cost: testCost(5),
      teamSpawns: { ...testTeamSpawns(), truncated: true }
    })

    expect(mapSessionTeams(groupTeams([capped])).get(key('capped'))).toEqual({
      kind: 'lead',
      teammates: [],
      cost: {
        leadUSD: 5,
        teamUSD: 5,
        sessionsWithoutCost: 0,
        missingTeammates: 0,
        teamListsTruncated: true
      }
    })
  })

  it('keys a cross-folder teammate by its own folder and points at the lead in another folder', () => {
    const teamLead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const worktreeAgent = testAgent(testRef('p--claude-worktrees-x', 'a'), {
      agentName: 'a',
      teamName: 'team'
    })

    const teams = mapSessionTeams(groupTeams([teamLead, worktreeAgent]))

    expect(teams.get(key('a', 'p--claude-worktrees-x'))).toMatchObject({
      kind: 'teammate',
      lead: ref('lead')
    })
    expect(teams.has(key('a'))).toBe(false)
  })
})
