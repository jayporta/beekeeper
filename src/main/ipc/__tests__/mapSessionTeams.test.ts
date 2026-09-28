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
import { mapSessionTeams } from '../mapSessionTeams'

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

  it('maps a lead to its teammate ids in grouping order and a field-exact cost rollup', () => {
    const teams = mapSessionTeams(groupTeams([lead, b, a]))

    expect(teams.get('lead')).toEqual({
      kind: 'lead',
      teammateSessionIds: ['a', 'b'],
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

    expect(teams.get('a')).toEqual({
      kind: 'teammate',
      leadSessionId: 'lead',
      joinedBy: 'spawn',
      stopped: true
    })
    expect(teams.get('b')).toEqual({
      kind: 'teammate',
      leadSessionId: 'lead',
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

    expect(teams.get('stray')).toEqual({
      kind: 'teammate',
      leadSessionId: 'lead',
      joinedBy: 'team',
      stopped: false
    })
  })

  it('maps an ungrouped session to its team name', () => {
    const orphan = testAgent(testRef('p', 'orphan'), { agentName: 'orphan', teamName: 'team-x' })

    expect(mapSessionTeams(groupTeams([orphan])).get('orphan')).toEqual({
      kind: 'ungrouped',
      teamName: 'team-x'
    })
  })

  it('maps an ungrouped session with no usable team to a null team name', () => {
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: null })

    expect(mapSessionTeams(groupTeams([stray])).get('stray')).toEqual({
      kind: 'ungrouped',
      teamName: null
    })
  })

  it('gives a solo lead no entry', () => {
    const solo = testLead(testRef('p', 'solo'), { cost: testCost(5) })

    expect(mapSessionTeams(groupTeams([solo])).has('solo')).toBe(false)
  })

  it('gives a lead with no teammates an entry when a spawned teammate never appeared', () => {
    const waiting = testLead(testRef('p', 'waiting'), {
      cost: testCost(5),
      teamSpawns: testTeamSpawns([testSpawn('ghost', 'team')])
    })

    expect(mapSessionTeams(groupTeams([waiting])).get('waiting')).toEqual({
      kind: 'lead',
      teammateSessionIds: [],
      cost: {
        leadUSD: 5,
        teamUSD: 5,
        sessionsWithoutCost: 0,
        missingTeammates: 1,
        teamListsTruncated: false
      }
    })
  })

  it('gives a lead with no teammates an entry when a spawn or stop list hit its cap', () => {
    const capped = testLead(testRef('p', 'capped'), {
      cost: testCost(5),
      teamSpawns: { ...testTeamSpawns(), truncated: true }
    })

    expect(mapSessionTeams(groupTeams([capped])).get('capped')).toEqual({
      kind: 'lead',
      teammateSessionIds: [],
      cost: {
        leadUSD: 5,
        teamUSD: 5,
        sessionsWithoutCost: 0,
        missingTeammates: 0,
        teamListsTruncated: true
      }
    })
  })
})
