import { describe, expect, it } from 'vitest'
import { groupTeams } from '../groupTeams'
import { rollupTeamUsage } from '../teamUsage'
import {
  testActivity,
  testAgent,
  testUsage,
  testLead,
  testRef,
  testSpawn,
  testStop,
  testTeamSpawns
} from '../testTeamFixtures'

function rollupOf(sessions: Parameters<typeof groupTeams>[0]): ReturnType<typeof rollupTeamUsage> {
  const group = groupTeams(sessions).leads[0]
  if (group === undefined) throw new Error('fixture has no lead')
  return rollupTeamUsage(group)
}

describe('rollupTeamUsage', () => {
  it('leaves a teammate with no cost out of teamUSD and counts it in sessionsWithoutCost', () => {
    const lead = testLead(testRef('p', 'lead'), {
      usage: testUsage(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(2)
    })
    const b = testAgent(testRef('p', 'b'), { agentName: 'b', teamName: 'team' })

    const rollup = rollupOf([lead, a, b])

    expect(rollup).toMatchObject({ teamUSD: 3, sessionsWithoutCost: 1 })
  })

  it('counts a teammate whose cost record has no total as without cost', () => {
    const lead = testLead(testRef('p', 'lead'), {
      usage: testUsage(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(null)
    })

    const rollup = rollupOf([lead, a])

    expect(rollup).toMatchObject({ teamUSD: 1, sessionsWithoutCost: 1 })
  })

  it('reports a null leadUSD and sums only the teammates when the lead has no cost', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(2)
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      usage: testUsage(5)
    })

    const rollup = rollupOf([lead, a, b])

    expect(rollup).toMatchObject({ leadUSD: null, teamUSD: 7, sessionsWithoutCost: 1 })
  })

  it('reports a null teamUSD when no session recorded a total', () => {
    const lead = testLead(testRef('p', 'lead'))

    expect(rollupOf([lead])).toMatchObject({ teamUSD: null, sessionsWithoutCost: 1 })
  })

  it('counts a teammate that recorded exactly zero as known, not missing', () => {
    const lead = testLead(testRef('p', 'lead'), {
      usage: testUsage(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(0)
    })

    const rollup = rollupOf([lead, a])

    expect(rollup).toMatchObject({ teamUSD: 1, sessionsWithoutCost: 0 })
  })

  it('reports a teamUSD of zero, not null, when every recorded total is zero', () => {
    const lead = testLead(testRef('p', 'lead'), { usage: testUsage(0) })

    expect(rollupOf([lead])).toMatchObject({ leadUSD: 0, teamUSD: 0, sessionsWithoutCost: 0 })
  })

  it('reports a null teamUSD when the sum is not finite', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(1e308)
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      usage: testUsage(1e308)
    })

    expect(rollupOf([lead, a, b]).teamUSD).toBeNull()
  })

  it('sums known token totals only and counts a teammate with none in sessionsWithoutTokens', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team'), testSpawn('b', 'team')]),
      usage: testUsage(1, 10)
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(1, 5)
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      usage: testUsage(1, null)
    })

    expect(rollupOf([lead, a, b])).toMatchObject({
      leadTokens: 10,
      teamTokens: 15,
      sessionsWithoutTokens: 1
    })
  })

  it('counts a session with a cost but no token total as without tokens, not without cost', () => {
    const lead = testLead(testRef('p', 'lead'), { usage: testUsage(2, null) })

    expect(rollupOf([lead])).toMatchObject({
      teamUSD: 2,
      sessionsWithoutCost: 0,
      leadTokens: null,
      teamTokens: null,
      sessionsWithoutTokens: 1
    })
  })

  it('reports a teamTokens of zero, not null, when every recorded token total is zero', () => {
    const lead = testLead(testRef('p', 'lead'), { usage: testUsage(0, 0) })

    expect(rollupOf([lead])).toMatchObject({
      leadTokens: 0,
      teamTokens: 0,
      sessionsWithoutTokens: 0
    })
  })

  it('reports a null teamTokens when the sum is not finite', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')]),
      usage: testUsage(1, 1e308)
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(1, 1e308)
    })

    expect(rollupOf([lead, a]).teamTokens).toBeNull()
  })

  it('splits a team spanning two leads between their rollups, which sum to the whole team', () => {
    const lead1 = testLead(testRef('p', 'lead1'), {
      activity: testActivity(0, 100),
      usage: testUsage(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')])
    })
    const lead2 = testLead(testRef('p', 'lead2'), {
      activity: testActivity(200, 300),
      usage: testUsage(10),
      teamSpawns: testTeamSpawns([testSpawn('b', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(2),
      activity: testActivity(50, 60)
    })
    const b = testAgent(testRef('p', 'b'), {
      agentName: 'b',
      teamName: 'team',
      usage: testUsage(20),
      activity: testActivity(250, 260)
    })

    const rollups = groupTeams([lead1, lead2, a, b]).leads.map(rollupTeamUsage)

    expect(rollups.map((r) => r.teamUSD)).toEqual([3, 30])
  })

  it('reports teamListsTruncated when lead spawns or stops hit their cap', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: { ...testTeamSpawns(), truncated: true }
    })

    expect(rollupOf([lead]).teamListsTruncated).toBe(true)
  })

  it('reports teamListsTruncated false when lead spawns and stops stay under their cap', () => {
    const lead = testLead(testRef('p', 'lead'))

    expect(rollupOf([lead]).teamListsTruncated).toBe(false)
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

    const rollups = groupTeams([lead1, lead2, a]).leads.map(rollupTeamUsage)

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
      usage: testUsage(1),
      teamSpawns: testTeamSpawns([testSpawn('a', 'team')], [testStop('a', 'team')])
    })
    const a = testAgent(testRef('p', 'a'), {
      agentName: 'a',
      teamName: 'team',
      usage: testUsage(4)
    })

    const rollup = rollupOf([lead, a])

    expect(rollup.teamUSD).toBe(5)
  })
})
