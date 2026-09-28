import { describe, expect, it } from 'vitest'
import { groupTeams } from '../groupTeams'
import { testAgent, testLead, testRef, testSpawn, testTeamSpawns } from '../testTeamFixtures'

describe('groupTeams pair join', () => {
  it('joins an agent session to the lead whose spawn named its exact (team, name) pair', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('reviewer', 'team-a')])
    })
    const teammate = testAgent(testRef('p', 'reviewer'), {
      agentName: 'reviewer',
      teamName: 'team-a'
    })

    const grouping = groupTeams([lead, teammate])

    expect(grouping.leads).toHaveLength(1)
    expect(grouping.leads[0]?.teammates).toEqual([
      { session: teammate, joinedBy: 'spawn', stopped: false }
    ])
    expect(grouping.ungrouped).toHaveLength(0)
  })

  it('orders a pair the lead spawned twice by its first spawn', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([
        testSpawn('alpha', 'team-a'),
        testSpawn('beta', 'team-a'),
        testSpawn('alpha', 'team-a')
      ])
    })
    const alpha = testAgent(testRef('p', 'alpha'), { agentName: 'alpha', teamName: 'team-a' })
    const beta = testAgent(testRef('p', 'beta'), { agentName: 'beta', teamName: 'team-a' })

    const grouping = groupTeams([lead, beta, alpha])

    expect(grouping.leads[0]?.teammates.map((t) => t.session)).toEqual([alpha, beta])
  })

  it('does not cross-join a name reused across two different teams', () => {
    const leadA = testLead(testRef('p', 'lead-a'), {
      teamSpawns: testTeamSpawns([testSpawn('reviewer', 'team-a')])
    })
    const leadB = testLead(testRef('p', 'lead-b'), {
      teamSpawns: testTeamSpawns([testSpawn('reviewer', 'team-b')])
    })
    const onA = testAgent(testRef('p', 'reviewer-a'), { agentName: 'reviewer', teamName: 'team-a' })
    const onB = testAgent(testRef('p', 'reviewer-b'), { agentName: 'reviewer', teamName: 'team-b' })

    const grouping = groupTeams([leadA, leadB, onA, onB])

    const groupOf = (ref: string): unknown =>
      grouping.leads
        .find((g) => g.lead.ref.sessionId === ref)
        ?.teammates.map((t) => t.session.ref.sessionId)
    expect(groupOf('lead-a')).toEqual(['reviewer-a'])
    expect(groupOf('lead-b')).toEqual(['reviewer-b'])
  })

  it('tolerates a spawn with no matching agent session', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('ghost', 'team-a')])
    })

    const grouping = groupTeams([lead])

    expect(grouping.leads[0]?.teammates).toHaveLength(0)
    expect(grouping.ungrouped).toHaveLength(0)
  })

  it('does not let a crafted agent session own teammates through its own spawns', () => {
    const realLead = testLead(testRef('p', 'lead'))
    const craftedAgent = testAgent(testRef('p', 'crafted'), {
      agentName: 'crafted',
      teamName: 'team-a',
      teamSpawns: testTeamSpawns([testSpawn('victim', 'team-b')])
    })
    const victim = testAgent(testRef('p', 'victim'), { agentName: 'victim', teamName: 'team-b' })

    const grouping = groupTeams([realLead, craftedAgent, victim])

    expect(grouping.leads[0]?.teammates).toHaveLength(0)
    expect(grouping.ungrouped.flatMap((g) => g.members)).toContainEqual(victim)
  })
})

describe('groupTeams team fallback', () => {
  it('joins by team alone when no lead spawned the exact pair', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const bob = testAgent(testRef('p', 'bob'), { agentName: 'bob', teamName: 'team-a' })

    const grouping = groupTeams([lead, bob])

    expect(grouping.leads[0]?.teammates).toEqual([
      { session: bob, joinedBy: 'team', stopped: false }
    ])
  })

  it('joins by team alone when the agent session has no usable name', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const nameless = testAgent(testRef('p', 'nameless'), { agentName: null, teamName: 'team-a' })

    const grouping = groupTeams([lead, nameless])

    expect(grouping.leads[0]?.teammates).toEqual([
      { session: nameless, joinedBy: 'team', stopped: false }
    ])
  })
})
