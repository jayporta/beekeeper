import { describe, expect, it } from 'vitest'
import { groupTeams } from '../groupTeams'
import { rollupTeamCost } from '../teamCost'
import {
  testActivity,
  testAgent,
  testCost,
  testLead,
  testRef,
  testSpawn,
  testStop,
  testTeamSpawns
} from '../testTeamFixtures'

function rollupOf(sessions: Parameters<typeof groupTeams>[0]): ReturnType<typeof rollupTeamCost> {
  const group = groupTeams(sessions).leads[0]
  if (group === undefined) throw new Error('fixture has no lead')
  return rollupTeamCost(group)
}

describe('rollupTeamCost', () => {
  it('leaves a teammate with no cost out of teamUSD and counts it in sessionsWithoutCost', () => {
    const lead = testLead(testRef('p', 'lead'), {
      cost: testCost(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), { agentName: 'a', teamName: 'team', cost: testCost(2) })
    const b = testAgent(testRef('p', 'b'), { agentName: 'b', teamName: 'team' })

    const rollup = rollupOf([lead, a, b])

    expect(rollup).toMatchObject({ teamUSD: 3, sessionsWithoutCost: 1 })
  })

  it('counts a teammate whose cost record has no total as without cost', () => {
    const lead = testLead(testRef('p', 'lead'), {
      cost: testCost(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      cost: testCost(null)
    })

    const rollup = rollupOf([lead, a])

    expect(rollup).toMatchObject({ teamUSD: 1, sessionsWithoutCost: 1 })
  })

  it('reports a null leadUSD and sums only the teammates when the lead has no cost', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), { agentName: 'a', teamName: 'team', cost: testCost(2) })
    const b = testAgent(testRef('p', 'b'), { agentName: 'b', teamName: 'team', cost: testCost(5) })

    const rollup = rollupOf([lead, a, b])

    expect(rollup).toMatchObject({ leadUSD: null, teamUSD: 7, sessionsWithoutCost: 1 })
  })

  it('reports a null teamUSD when no session recorded a total', () => {
    const lead = testLead(testRef('p', 'lead'))

    expect(rollupOf([lead])).toMatchObject({ teamUSD: null, sessionsWithoutCost: 1 })
  })

  it('counts a teammate that recorded exactly zero as known, not missing', () => {
    const lead = testLead(testRef('p', 'lead'), {
      cost: testCost(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), { agentName: 'a', teamName: 'team', cost: testCost(0) })

    const rollup = rollupOf([lead, a])

    expect(rollup).toMatchObject({ teamUSD: 1, sessionsWithoutCost: 0 })
  })

  it('reports a teamUSD of zero, not null, when every recorded total is zero', () => {
    const lead = testLead(testRef('p', 'lead'), { cost: testCost(0) })

    expect(rollupOf([lead])).toMatchObject({ leadUSD: 0, teamUSD: 0, sessionsWithoutCost: 0 })
  })

  it('reports a null teamUSD when the sum is not finite', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      cost: testCost(1e308)
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      cost: testCost(1e308)
    })

    expect(rollupOf([lead, a, b]).teamUSD).toBeNull()
  })

  it('splits a team spanning two leads between their rollups, which sum to the whole team', () => {
    const lead1 = testLead(testRef('p', 'lead1'), {
      activity: testActivity(0, 100),
      cost: testCost(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const lead2 = testLead(testRef('p', 'lead2'), {
      activity: testActivity(200, 300),
      cost: testCost(10),
      teamSpawns: testTeamSpawns([testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      cost: testCost(2),
      activity: testActivity(50, 60)
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      cost: testCost(20),
      activity: testActivity(250, 260)
    })

    const rollups = groupTeams([lead1, lead2, a, b]).leads.map(rollupTeamCost)

    expect(rollups.map((r) => r.teamUSD)).toEqual([3, 30])
  })

  it('counts a spawned pair with no matching session as a missing teammate', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('ghost', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), { agentName: 'a', teamName: 'team' })

    expect(rollupOf([lead, a]).missingTeammates).toBe(1)
  })

  it('counts a pair the lead spawned twice as one missing teammate', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('Ghost', 'team'), testSpawn('ghost', 'TEAM')])
    })

    expect(rollupOf([lead]).missingTeammates).toBe(1)
  })

  it('ignores a spawn that named no team when counting missing teammates', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('ghost', null)])
    })

    expect(rollupOf([lead]).missingTeammates).toBe(0)
  })

  it('counts a pair both leads spawned as missing under the lead the teammate did not join', () => {
    const spawns = testTeamSpawns([testSpawn('a', 'team')])
    const lead1 = testLead(testRef('p', 'lead1'), {
      activity: testActivity(0, 100),
      teamSpawns: spawns
    })
    const lead2 = testLead(testRef('p', 'lead2'), {
      activity: testActivity(200, 300),
      teamSpawns: spawns
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      activity: testActivity(250, 260)
    })

    const rollups = groupTeams([lead1, lead2, a]).leads.map(rollupTeamCost)

    expect(rollups.map((r) => r.missingTeammates)).toEqual([1, 0])
  })

  it('does not reduce missingTeammates for a teammate whose pair the lead never spawned', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const stray = testAgent(testRef('p', 'stray'), { agentName: 'stray', teamName: 'team' })

    // `a` never joined, so it is still missing even though a team-joined teammate is present.
    expect(rollupOf([lead, stray]).missingTeammates).toBe(1)
  })

  it('keeps a stopped teammate cost in the total', () => {
    const lead = testLead(testRef('p', 'lead'), {
      cost: testCost(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')], [testStop('a', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), { agentName: 'a', teamName: 'team', cost: testCost(4) })

    const rollup = rollupOf([lead, a])

    expect(rollup.teamUSD).toBe(5)
  })
})
