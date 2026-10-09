import { describe, expect, it } from 'vitest'
import { groupTeams } from '../../../core/teams/groupTeams'
import {
  testAgent,
  testLead,
  testRef,
  testSpawn,
  testStop,
  testTeamSpawns,
  testUsage
} from '../../../core/teams/testTeamFixtures'
import { EMPTY_SIGNALS } from '../../../core/transcript/summary/testSessionSummary'
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
    usage: testUsage(1, 10),
    signals: { ...EMPTY_SIGNALS, toolErrors: 4, compactions: 1 },
    teamSpawns: testTeamSpawns(
      [testSpawn('a', 'team'), testSpawn('b', 'team'), testSpawn('ghost', 'team')],
      [testStop('a', 'team')]
    )
  })
  const a = testAgent(testRef('p', 'a'), {
    agentName: 'a',
    teamName: 'team',
    usage: testUsage(2, 5),
    signals: { ...EMPTY_SIGNALS, toolErrors: 3, agentsKilled: 2 }
  })
  const b = testAgent(testRef('p', 'b'), { agentName: 'b', teamName: 'team' })

  it('maps a lead to its teammate refs in grouping order and a field-exact usage rollup', () => {
    const teams = mapSessionTeams(groupTeams([lead, b, a]))

    expect(teams.get(key('lead'))).toEqual({
      kind: 'lead',
      teammates: [ref('a'), ref('b')],
      usage: {
        leadUSD: 1,
        teamUSD: 3,
        sessionsWithoutCost: 1,
        leadTokens: 10,
        teamTokens: 15,
        sessionsWithoutTokens: 1,
        missingTeammates: 1,
        teamListsTruncated: false,
        signalTotals: { toolErrors: 7, compactions: 1, agentsKilled: 2 }
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
    const solo = testLead(testRef('p', 'solo'), { usage: testUsage(5, 50) })

    expect(mapSessionTeams(groupTeams([solo])).has(key('solo'))).toBe(false)
  })

  it('gives a lead with no teammates an entry when a spawned teammate never appeared', () => {
    const waiting = testLead(testRef('p', 'waiting'), {
      usage: testUsage(5, 50),
      teamSpawns: testTeamSpawns([testSpawn('ghost', 'team')])
    })

    expect(mapSessionTeams(groupTeams([waiting])).get(key('waiting'))).toEqual({
      kind: 'lead',
      teammates: [],
      usage: {
        leadUSD: 5,
        teamUSD: 5,
        sessionsWithoutCost: 0,
        leadTokens: 50,
        teamTokens: 50,
        sessionsWithoutTokens: 0,
        missingTeammates: 1,
        teamListsTruncated: false,
        signalTotals: { toolErrors: 0, compactions: 0, agentsKilled: 0 }
      }
    })
  })

  it('gives a lead with no teammates an entry when its spawns or stops hit their cap', () => {
    const capped = testLead(testRef('p', 'capped'), {
      usage: testUsage(5, 50),
      teamSpawns: { ...testTeamSpawns(), truncated: true }
    })

    expect(mapSessionTeams(groupTeams([capped])).get(key('capped'))).toEqual({
      kind: 'lead',
      teammates: [],
      usage: {
        leadUSD: 5,
        teamUSD: 5,
        sessionsWithoutCost: 0,
        leadTokens: 50,
        teamTokens: 50,
        sessionsWithoutTokens: 0,
        missingTeammates: 0,
        teamListsTruncated: true,
        signalTotals: { toolErrors: 0, compactions: 0, agentsKilled: 0 }
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
