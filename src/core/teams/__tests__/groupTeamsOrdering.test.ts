import { describe, expect, it } from 'vitest'
import { groupTeams } from '../groupTeams'
import {
  testActivity,
  testAgent,
  testLead,
  testRef,
  testSpawn,
  testStop,
  testTeamSpawns
} from '../testTeamFixtures'

describe('groupTeams respawn order', () => {
  it('lists respawns in the lead spawn order, not by activity time', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([
        testSpawn('reviewer-r1', 'team-a'),
        testSpawn('reviewer-r2', 'team-a')
      ])
    })
    // r2 started earlier than r1, so a time-based order would reverse them.
    const r1 = testAgent(testRef('p', 'r1'), {
      agentName: 'reviewer-r1',
      teamName: 'team-a',
      activity: testActivity(200, 300)
    })
    const r2 = testAgent(testRef('p', 'r2'), {
      agentName: 'reviewer-r2',
      teamName: 'team-a',
      activity: testActivity(0, 100)
    })

    const grouping = groupTeams([lead, r2, r1])

    expect(grouping.leads[0]?.teammates.map((t) => t.session)).toEqual([r1, r2])
  })

  it('orders teammates sharing one folded pair the same way whatever the input order', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('reviewer', 'team-a')])
    })
    const first = testAgent(testRef('p', 'reviewer-1'), {
      agentName: 'reviewer',
      teamName: 'team-a',
      activity: testActivity(0, 10)
    })
    const second = testAgent(testRef('p', 'reviewer-2'), {
      agentName: 'reviewer',
      teamName: 'team-a',
      activity: testActivity(20, 30)
    })

    const forward = groupTeams([lead, first, second])
    const reversed = groupTeams([lead, second, first])

    const sessionsOf = (grouping: ReturnType<typeof groupTeams>): unknown =>
      grouping.leads[0]?.teammates.map((t) => t.session)
    expect(sessionsOf(forward)).toEqual([first, second])
    expect(sessionsOf(reversed)).toEqual([first, second])
  })

  it('lists spawn-joined teammates before team-joined ones', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const alice = testAgent(testRef('p', 'alice'), {
      agentName: 'alice',
      teamName: 'team-a',
      activity: testActivity(0, 10)
    })
    // bob team-joins with no direct spawn; earlier activity than alice, but must still list after her.
    const bob = testAgent(testRef('p', 'bob'), {
      agentName: 'bob',
      teamName: 'team-a',
      activity: testActivity(-100, -50)
    })

    const grouping = groupTeams([lead, bob, alice])

    expect(grouping.leads[0]?.teammates.map((t) => t.session.ref.sessionId)).toEqual([
      'alice',
      'bob'
    ])
  })
})

describe('groupTeams team spanning two lead transcripts', () => {
  it('splits team-fallback members between two leads by which span contains their start', () => {
    const lead1 = testLead(testRef('p', 'lead1'), {
      activity: testActivity(0, 100),
      teamSpawns: testTeamSpawns([testSpawn('alice', 'team-a')])
    })
    const lead2 = testLead(testRef('p', 'lead2'), {
      activity: testActivity(100, 200),
      teamSpawns: testTeamSpawns([testSpawn('bob', 'team-a')])
    })
    const bob = testAgent(testRef('p', 'bob'), {
      agentName: 'bob',
      teamName: 'team-a',
      activity: testActivity(100, 110)
    })
    const carol = testAgent(testRef('p', 'carol'), {
      agentName: 'carol',
      teamName: 'team-a',
      activity: testActivity(50, 60)
    })
    const dave = testAgent(testRef('p', 'dave'), {
      agentName: 'dave',
      teamName: 'team-a',
      activity: testActivity(150, 160)
    })

    const grouping = groupTeams([lead1, lead2, bob, carol, dave])

    const under = (sessionId: string): string[] | undefined =>
      grouping.leads
        .find((g) => g.lead.ref.sessionId === sessionId)
        ?.teammates.map((t) => t.session.ref.sessionId)
    expect(under('lead1')).toEqual(['carol'])
    expect(under('lead2')).toEqual(['bob', 'dave'])
  })
})

describe('groupTeams pair spawned by two leads', () => {
  it('breaks the tie by which candidate span contains the teammate start', () => {
    const lead1 = testLead(testRef('p', 'lead1'), {
      activity: testActivity(0, 100),
      teamSpawns: testTeamSpawns([testSpawn('eve', 'team-a')])
    })
    const lead2 = testLead(testRef('p', 'lead2'), {
      activity: testActivity(100, 200),
      teamSpawns: testTeamSpawns([testSpawn('eve', 'team-a')])
    })
    const eve = testAgent(testRef('p', 'eve'), {
      agentName: 'eve',
      teamName: 'team-a',
      activity: testActivity(150, 160)
    })

    const grouping = groupTeams([lead1, lead2, eve])

    const leadOf = grouping.leads.find((g) => g.teammates.some((t) => t.session === eve))
    expect(leadOf?.lead.ref.sessionId).toBe('lead2')
  })
})

describe('groupTeams stops', () => {
  it('does not mark a teammate stopped by a stop a different lead recorded', () => {
    const spawningLead = testLead(testRef('p', 'spawner'), {
      teamSpawns: testTeamSpawns([testSpawn('frank', 'team-a')])
    })
    const otherLead = testLead(testRef('p', 'other'), {
      teamSpawns: testTeamSpawns([], [testStop('frank', 'team-a')])
    })
    const frank = testAgent(testRef('p', 'frank'), { agentName: 'frank', teamName: 'team-a' })

    const grouping = groupTeams([spawningLead, otherLead, frank])

    const spawnerGroup = grouping.leads.find((g) => g.lead.ref.sessionId === 'spawner')
    expect(spawnerGroup?.teammates[0]?.stopped).toBe(false)
  })

  it('marks a teammate stopped by a stop its own lead recorded', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('frank', 'team-a')], [testStop('Frank', 'Team-A')])
    })
    const frank = testAgent(testRef('p', 'frank'), { agentName: 'frank', teamName: 'team-a' })

    const grouping = groupTeams([lead, frank])

    expect(grouping.leads[0]?.teammates[0]?.stopped).toBe(true)
  })

  it('leaves a teammate unstopped when no lead recorded its stop', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('gina', 'team-a')])
    })
    const gina = testAgent(testRef('p', 'gina'), { agentName: 'gina', teamName: 'team-a' })

    const grouping = groupTeams([lead, gina])

    expect(grouping.leads[0]?.teammates[0]?.stopped).toBe(false)
  })

  it('never matches a stop that named no team', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('henry', 'team-a')], [testStop('henry', null)])
    })
    const henry = testAgent(testRef('p', 'henry'), { agentName: 'henry', teamName: 'team-a' })

    const grouping = groupTeams([lead, henry])

    expect(grouping.leads[0]?.teammates[0]?.stopped).toBe(false)
  })
})

describe('groupTeams sessions with no assistant records', () => {
  it('still lists a teammate with null cost and activity', () => {
    const lead = testLead(testRef('p', 'lead'), {
      teamSpawns: testTeamSpawns([testSpawn('quiet', 'team-a')])
    })
    const quiet = testAgent(testRef('p', 'quiet'), { agentName: 'quiet', teamName: 'team-a' })

    const grouping = groupTeams([lead, quiet])

    expect(grouping.leads[0]?.teammates).toEqual([
      { session: quiet, joinedBy: 'spawn', stopped: false }
    ])
  })
})

describe('groupTeams leads and ungrouped ordering', () => {
  it('orders leads by activity start, with a lead with no activity last', () => {
    const later = testLead(testRef('p', 'later'), { activity: testActivity(200, 300) })
    const noActivity = testLead(testRef('p', 'none'))
    const earlier = testLead(testRef('p', 'earlier'), { activity: testActivity(0, 100) })

    const grouping = groupTeams([later, noActivity, earlier])

    expect(grouping.leads.map((g) => g.lead.ref.sessionId)).toEqual(['earlier', 'later', 'none'])
  })

  it('orders ungrouped teams by their earliest-starting member, not input order', () => {
    const laterTeamA = testAgent(testRef('p', 'a1'), {
      agentName: 'a1',
      teamName: 'team-a',
      activity: testActivity(200, 300)
    })
    const earlierTeamB = testAgent(testRef('p', 'b1'), {
      agentName: 'b1',
      teamName: 'team-b',
      activity: testActivity(0, 100)
    })

    // team-a appears first in the input, but team-b's member starts earlier.
    const grouping = groupTeams([laterTeamA, earlierTeamB])

    expect(grouping.ungrouped.map((g) => g.teamName)).toEqual(['team-b', 'team-a'])
  })

  it('takes an ungrouped team display spelling from its earliest-starting member', () => {
    const laterSpelling = testAgent(testRef('p', 'later'), {
      agentName: 'later',
      teamName: 'Team-A',
      activity: testActivity(200, 300)
    })
    const earlierSpelling = testAgent(testRef('p', 'earlier'), {
      agentName: 'earlier',
      teamName: 'team-a',
      activity: testActivity(0, 100)
    })

    // The later-spelled session appears first in the input.
    const grouping = groupTeams([laterSpelling, earlierSpelling])

    expect(grouping.ungrouped[0]?.teamName).toBe('team-a')
  })

  it('orders members within an ungrouped team by activity start, not input order', () => {
    const later = testAgent(testRef('p', 'later'), {
      agentName: 'later',
      teamName: 'team-a',
      activity: testActivity(200, 300)
    })
    const earlier = testAgent(testRef('p', 'earlier'), {
      agentName: 'earlier',
      teamName: 'team-a',
      activity: testActivity(0, 100)
    })

    const grouping = groupTeams([later, earlier])

    expect(grouping.ungrouped[0]?.members).toEqual([earlier, later])
  })
})
